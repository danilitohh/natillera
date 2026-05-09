import Link from "next/link";

import {
  deleteLoanAction,
  recordLoanPaymentAction,
  saveLoanAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/layout/admin-shell";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAdminSession } from "@/lib/auth";
import { formatDate, toDateInputValue } from "@/lib/date";
import { calculateDashboardMetrics, getLoanSnapshot } from "@/lib/finance/calculations";
import { readDatabase } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  success?: string | string[];
  error?: string | string[];
  edit?: string | string[];
}>;

function getSearchParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function loanStatusToBadge(status: string) {
  if (status === "paid") {
    return "paid" as const;
  }

  if (status === "overdue") {
    return "overdue" as const;
  }

  return "partial" as const;
}

export default async function LoansPage(props: { searchParams: SearchParams }) {
  const session = await requireAdminSession();
  const searchParams = await props.searchParams;
  const database = await readDatabase();
  const editId = getSearchParam(searchParams.edit);
  const participants = database.participants.filter((participant) => participant.active);
  const editingLoan = database.loans.find((loan) => loan.id === editId);
  const editingParticipant = editingLoan
    ? database.participants.find((participant) => participant.id === editingLoan.participantId)
    : undefined;
  const participantOptions = editingParticipant
    ? [
        ...participants,
        ...(!participants.some((participant) => participant.id === editingParticipant.id)
          ? [editingParticipant]
          : []),
      ]
    : participants;
  const metrics = calculateDashboardMetrics(database);
  const today = toDateInputValue(new Date());
  const loanSnapshots = database.loans
    .map((loan) => getLoanSnapshot(loan, database.loanInstallments))
    .sort(
      (left, right) =>
        new Date(right.loan.issuedAt).getTime() - new Date(left.loan.issuedAt).getTime(),
    );

  return (
    <AdminShell
      title="Préstamos"
      description="Los desembolsos salen de caja y cada cuota se divide entre capital e interés del 5% mensual."
      username={session.username}
    >
      <FeedbackBanner
        success={getSearchParam(searchParams.success)}
        error={getSearchParam(searchParams.error)}
      />

      {participants.length === 0 ? (
        <EmptyState
          title="No hay participantes activos"
          description="Primero registra participantes activos antes de entregar préstamos."
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div id="loan-form" className="panel self-start lg:sticky lg:top-6">
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              {editingLoan ? "Editar préstamo" : "Nuevo préstamo"}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Caja disponible actual: {formatCurrency(metrics.availableCash)}
            </p>
            {editingParticipant ? (
              <p className="mt-2 text-sm text-[var(--brand-600)]">
                Editando préstamo de {editingParticipant.fullName}
                {!editingParticipant.active ? " (participante inactivo)" : ""}
              </p>
            ) : null}

            <form action={saveLoanAction} className="mt-6 grid gap-4">
              <input type="hidden" name="id" value={editingLoan?.id ?? ""} />

              <div>
                <label htmlFor="participantId" className="label">
                  Participante
                </label>
                <select
                  id="participantId"
                  name="participantId"
                  className="select"
                  defaultValue={editingLoan?.participantId}
                  required
                >
                  <option value="">Selecciona</option>
                  {participantOptions.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.fullName}
                      {!participant.active ? " (inactivo)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="principalAmount" className="label">
                  Monto prestado
                </label>
                <input
                  id="principalAmount"
                  name="principalAmount"
                  type="number"
                  min="0"
                  className="input"
                  defaultValue={editingLoan?.principalAmount ?? ""}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="issuedAt" className="label">
                    Fecha del préstamo
                  </label>
                  <input
                    id="issuedAt"
                    name="issuedAt"
                    type="date"
                    className="input"
                    defaultValue={editingLoan?.issuedAt ?? today}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="installmentCount" className="label">
                    Número de cuotas
                  </label>
                  <input
                    id="installmentCount"
                    name="installmentCount"
                    type="number"
                    min="1"
                    className="input"
                    defaultValue={editingLoan?.installmentCount ?? 1}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="status" className="label">
                  Estado
                </label>
                <select
                  id="status"
                  name="status"
                  className="select"
                  defaultValue={editingLoan?.status ?? "active"}
                >
                  <option value="active">Activo</option>
                  <option value="paid">Pagado</option>
                  <option value="overdue">Vencido</option>
                  <option value="refinanced">Refinanciado</option>
                </select>
              </div>

              <div>
                <label htmlFor="notes" className="label">
                  Observaciones
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  className="textarea"
                  defaultValue={editingLoan?.notes}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <SubmitButton
                  label={editingLoan ? "Guardar préstamo" : "Crear préstamo"}
                  pendingLabel="Guardando..."
                />
                {editingLoan ? (
                  <Link href="/admin/loans" className="pill-link">
                    Cancelar
                  </Link>
                ) : null}
              </div>
            </form>
          </div>

          <div className="panel">
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              Préstamos registrados
            </h3>

            {loanSnapshots.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="Aún no hay préstamos"
                  description="Cuando registres el primero, aquí verás cuotas, intereses y saldo pendiente."
                />
              </div>
            ) : (
              <div className="mt-6 grid gap-5">
                {loanSnapshots.map((snapshot) => {
                  const participant = database.participants.find(
                    (item) => item.id === snapshot.loan.participantId,
                  );

                  return (
                    <article
                      key={snapshot.loan.id}
                      className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-lg shadow-black/5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h4 className="text-lg font-semibold text-[var(--foreground)]">
                            {participant?.fullName}
                          </h4>
                          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                            Préstamo entregado el {formatDate(snapshot.loan.issuedAt)} •{" "}
                            {snapshot.loan.installmentCount} cuota(s)
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={loanStatusToBadge(snapshot.status)} />
                          <Link href={`/admin/loans?edit=${snapshot.loan.id}#loan-form`} className="pill-link">
                            Editar
                          </Link>
                          <form action={deleteLoanAction}>
                            <input type="hidden" name="id" value={snapshot.loan.id} />
                            <ConfirmButton
                              label="Eliminar"
                              message="¿Eliminar este préstamo? Solo podrás hacerlo si no tiene pagos."
                            />
                          </form>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Principal
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {formatCurrency(snapshot.loan.principalAmount)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Intereses generados
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {formatCurrency(snapshot.totalInterestGenerated)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Total pagado
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {formatCurrency(snapshot.totalPaid)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Saldo pendiente
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {formatCurrency(snapshot.totalOutstanding)}
                          </p>
                        </div>
                      </div>

                      <div className="table-wrap mt-5">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Cuota</th>
                              <th>Vence</th>
                              <th>Capital</th>
                              <th>Interés</th>
                              <th>Saldo</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.installments.map((installment) => (
                              <tr key={installment.installment.id}>
                                <td>
                                  #{installment.installment.installmentNumber}
                                  <div className="mt-1">
                                    <StatusBadge status={installment.status} />
                                  </div>
                                </td>
                                <td>{formatDate(installment.installment.dueDate)}</td>
                                <td>{formatCurrency(installment.installment.capitalAmount)}</td>
                                <td>{formatCurrency(installment.installment.interestAmount)}</td>
                                <td>{formatCurrency(installment.totalOutstanding)}</td>
                                <td>
                                  {installment.totalOutstanding > 0 ? (
                                    <form
                                      action={recordLoanPaymentAction}
                                      className="grid gap-2 sm:grid-cols-[120px_140px_auto]"
                                    >
                                      <input
                                        type="hidden"
                                        name="installmentId"
                                        value={installment.installment.id}
                                      />
                                      <input
                                        type="text"
                                        name="paymentAmount"
                                        inputMode="numeric"
                                        placeholder="Abono"
                                        aria-label={`Abono cuota ${installment.installment.installmentNumber}`}
                                        autoComplete="off"
                                        className="input"
                                        required
                                      />
                                      <input
                                        type="date"
                                        name="paidAt"
                                        defaultValue={today}
                                        className="input"
                                      />
                                      <SubmitButton
                                        label="Registrar"
                                        pendingLabel="..."
                                        className="h-full px-4"
                                      />
                                    </form>
                                  ) : (
                                    "Pagada"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
