import Link from "next/link";

import {
  deleteTripContributionAction,
  saveTripContributionAction,
} from "@/app/admin/actions";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { AdminShell } from "@/components/layout/admin-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { StatusBadge } from "@/components/ui/status-badge";
import { MONTH_OPTIONS } from "@/lib/constants";
import { requireAdminSession } from "@/lib/auth";
import {
  formatDate,
  formatMonthYear,
  getContributionDefaultDueDate,
  getCurrentMonth,
  getCurrentYear,
  getYearOptions,
} from "@/lib/date";
import { getTripSnapshot } from "@/lib/finance/calculations";
import { readDatabase } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  success?: string | string[];
  error?: string | string[];
  edit?: string | string[];
  month?: string | string[];
  year?: string | string[];
}>;

function getSearchParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CovenasPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireAdminSession();
  const searchParams = await props.searchParams;
  const database = await readDatabase();
  const editId = getSearchParam(searchParams.edit);
  const selectedMonth = Number(getSearchParam(searchParams.month) || getCurrentMonth());
  const selectedYear = Number(getSearchParam(searchParams.year) || getCurrentYear());
  const participants = database.participants.filter((participant) => participant.active);
  const editingRecord = database.tripContributions.find((record) => record.id === editId);
  const filteredSnapshots = database.tripContributions
    .filter((record) => record.month === selectedMonth && record.year === selectedYear)
    .map((record) => getTripSnapshot(record))
    .sort((left, right) =>
      left.record.participantId.localeCompare(right.record.participantId),
    );

  return (
    <AdminShell
      title="Viaje Coveñas"
      description="Ahorro mensual separado para el viaje. Cada participante puede tener una cuota distinta y este dinero entra a caja, pero no al fondo común ni a la liquidación final."
      username={session.username}
    >
      <FeedbackBanner
        success={getSearchParam(searchParams.success)}
        error={getSearchParam(searchParams.error)}
      />

      {participants.length === 0 ? (
        <EmptyState
          title="Necesitas participantes activos"
          description="Registra participantes antes de empezar a cargar el ahorro del viaje."
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="panel">
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              {editingRecord ? "Editar ahorro" : "Registrar ahorro"}
            </h3>

            <form action={saveTripContributionAction} className="mt-6 grid gap-4">
              <input type="hidden" name="id" value={editingRecord?.id ?? ""} />

              <div>
                <label htmlFor="participantId" className="label">
                  Participante
                </label>
                <select
                  id="participantId"
                  name="participantId"
                  className="select"
                  defaultValue={editingRecord?.participantId}
                  required
                >
                  <option value="">Selecciona</option>
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="month" className="label">
                    Mes
                  </label>
                  <select
                    id="month"
                    name="month"
                    className="select"
                    defaultValue={String(editingRecord?.month ?? selectedMonth)}
                  >
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="year" className="label">
                    Año
                  </label>
                  <select
                    id="year"
                    name="year"
                    className="select"
                    defaultValue={String(editingRecord?.year ?? selectedYear)}
                  >
                    {getYearOptions(5).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="quotaAmount" className="label">
                    Cuota del viaje
                  </label>
                  <input
                    id="quotaAmount"
                    name="quotaAmount"
                    type="number"
                    min="0"
                    className="input"
                    defaultValue={editingRecord?.quotaAmount ?? ""}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="amountPaid" className="label">
                    Valor pagado
                  </label>
                  <input
                    id="amountPaid"
                    name="amountPaid"
                    type="number"
                    min="0"
                    className="input"
                    defaultValue={editingRecord?.amountPaid ?? 0}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="dueDate" className="label">
                    Fecha límite
                  </label>
                  <input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    className="input"
                    defaultValue={
                      editingRecord?.dueDate ??
                      getContributionDefaultDueDate(selectedMonth, selectedYear)
                    }
                    required
                  />
                </div>
                <div>
                  <label htmlFor="paidAt" className="label">
                    Fecha de pago
                  </label>
                  <input
                    id="paidAt"
                    name="paidAt"
                    type="date"
                    className="input"
                    defaultValue={editingRecord?.paidAt}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="label">
                  Observaciones
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  className="textarea"
                  defaultValue={editingRecord?.notes}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <SubmitButton
                  label={editingRecord ? "Guardar ahorro" : "Registrar ahorro"}
                  pendingLabel="Guardando..."
                />
                {editingRecord ? (
                  <Link
                    href={`/admin/covenas?month=${selectedMonth}&year=${selectedYear}`}
                    className="pill-link"
                  >
                    Cancelar
                  </Link>
                ) : null}
              </div>
            </form>
          </div>

          <div className="panel">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  Historial mensual del viaje
                </h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Revisa quién está al día, parcial o vencido en el ahorro para Coveñas.
                </p>
              </div>

              <form className="grid gap-3 sm:grid-cols-3">
                <select name="month" className="select" defaultValue={String(selectedMonth)}>
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                <select name="year" className="select" defaultValue={String(selectedYear)}>
                  {getYearOptions(5).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button type="submit" className="pill-link justify-center">
                  Filtrar
                </button>
              </form>
            </div>

            {filteredSnapshots.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="Sin ahorro registrado para este periodo"
                  description="Registra las cuotas mensuales del viaje para empezar el seguimiento."
                />
              </div>
            ) : (
              <div className="table-wrap mt-6">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Participante</th>
                      <th>Periodo</th>
                      <th>Cuota</th>
                      <th>Pagado</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSnapshots.map((snapshot) => {
                      const participant = database.participants.find(
                        (item) => item.id === snapshot.record.participantId,
                      );

                      return (
                        <tr key={snapshot.record.id}>
                          <td>
                            <div className="font-semibold">{participant?.fullName}</div>
                            <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                              Límite: {formatDate(snapshot.record.dueDate)}
                            </div>
                          </td>
                          <td>{formatMonthYear(snapshot.record.month, snapshot.record.year)}</td>
                          <td>{formatCurrency(snapshot.record.quotaAmount)}</td>
                          <td>{formatCurrency(snapshot.record.amountPaid)}</td>
                          <td>
                            <StatusBadge status={snapshot.status} />
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/admin/covenas?edit=${snapshot.record.id}&month=${selectedMonth}&year=${selectedYear}`}
                                className="pill-link"
                              >
                                Editar
                              </Link>
                              <form action={deleteTripContributionAction}>
                                <input type="hidden" name="id" value={snapshot.record.id} />
                                <ConfirmButton
                                  label="Eliminar"
                                  message="¿Seguro que quieres eliminar este ahorro del viaje?"
                                />
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
