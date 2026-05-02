import Link from "next/link";

import {
  deleteRaffleEntryAction,
  saveRaffleEntryAction,
  saveRaffleRoundAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/layout/admin-shell";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { StatusBadge } from "@/components/ui/status-badge";
import { MONTH_OPTIONS, RAFFLE_FIXED_AMOUNT } from "@/lib/constants";
import { requireAdminSession } from "@/lib/auth";
import {
  formatDate,
  formatMonthYear,
  getCurrentMonth,
  getCurrentYear,
  getLastFridayOfMonth,
  getYearOptions,
  toDateInputValue,
} from "@/lib/date";
import {
  buildMonthlyRaffleSummaries,
  getRaffleSnapshot,
} from "@/lib/finance/calculations";
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

export default async function RafflesPage(props: { searchParams: SearchParams }) {
  const session = await requireAdminSession();
  const searchParams = await props.searchParams;
  const database = await readDatabase();
  const editId = getSearchParam(searchParams.edit);
  const selectedMonth = Number(getSearchParam(searchParams.month) || getCurrentMonth());
  const selectedYear = Number(getSearchParam(searchParams.year) || getCurrentYear());
  const participants = database.participants.filter((participant) => participant.active);
  const editingRecord = database.raffleEntries.find((record) => record.id === editId);
  const entries = database.raffleEntries
    .filter((record) => record.month === selectedMonth && record.year === selectedYear)
    .map((record) => getRaffleSnapshot(record));
  const monthlySummaries = buildMonthlyRaffleSummaries(database);
  const lastFriday = toDateInputValue(getLastFridayOfMonth(selectedMonth, selectedYear));

  return (
    <AdminShell
      title="Polla mensual"
      description="Cada participante aporta $5.000, elige un número y el último viernes del mes se define el ganador, quien recibe el 50% de lo recaudado."
      username={session.username}
    >
      <FeedbackBanner
        success={getSearchParam(searchParams.success)}
        error={getSearchParam(searchParams.error)}
      />

      {participants.length === 0 ? (
        <EmptyState
          title="No hay participantes activos"
          description="Primero registra participantes activos para poder asignar números de polla."
        />
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="panel">
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                {editingRecord ? "Editar registro" : "Registrar participante en polla"}
              </h3>

              <form action={saveRaffleEntryAction} className="mt-6 grid gap-4">
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
                    <label htmlFor="selectedNumber" className="label">
                      Número elegido
                    </label>
                    <input
                      id="selectedNumber"
                      name="selectedNumber"
                      type="number"
                      min="0"
                      className="input"
                      defaultValue={editingRecord?.selectedNumber ?? ""}
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
                      max={RAFFLE_FIXED_AMOUNT}
                      className="input"
                      defaultValue={editingRecord?.amountPaid ?? RAFFLE_FIXED_AMOUNT}
                      required
                    />
                    <p className="helper">Valor fijo sugerido: {formatCurrency(RAFFLE_FIXED_AMOUNT)}</p>
                  </div>
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
                    label={editingRecord ? "Guardar registro" : "Registrar en polla"}
                    pendingLabel="Guardando..."
                  />
                  {editingRecord ? (
                    <Link href={`/admin/raffles?month=${selectedMonth}&year=${selectedYear}`} className="pill-link">
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
                    Registros del mes
                  </h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    Último viernes del mes: {formatDate(lastFriday)}
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

              {entries.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title="Aún no hay registros de polla"
                    description="Registra a los participantes del mes con su número y estado de pago."
                  />
                </div>
              ) : (
                <div className="table-wrap mt-6">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Participante</th>
                        <th>Número</th>
                        <th>Pagado</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((snapshot) => {
                        const participant = database.participants.find(
                          (item) => item.id === snapshot.record.participantId,
                        );

                        return (
                          <tr key={snapshot.record.id}>
                            <td>{participant?.fullName}</td>
                            <td>#{snapshot.record.selectedNumber}</td>
                            <td>{formatCurrency(snapshot.record.amountPaid)}</td>
                            <td>
                              <StatusBadge status={snapshot.status} />
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/admin/raffles?edit=${snapshot.record.id}&month=${selectedMonth}&year=${selectedYear}`}
                                  className="pill-link"
                                >
                                  Editar
                                </Link>
                                <form action={deleteRaffleEntryAction}>
                                  <input type="hidden" name="id" value={snapshot.record.id} />
                                  <ConfirmButton
                                    label="Eliminar"
                                    message="¿Eliminar este registro de polla?"
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

          <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="panel">
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                Registrar ganador del mes
              </h3>
              <form action={saveRaffleRoundAction} className="mt-6 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="winnerMonth" className="label">
                      Mes
                    </label>
                    <select
                      id="winnerMonth"
                      name="month"
                      className="select"
                      defaultValue={String(selectedMonth)}
                    >
                      {MONTH_OPTIONS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="winnerYear" className="label">
                      Año
                    </label>
                    <select
                      id="winnerYear"
                      name="year"
                      className="select"
                      defaultValue={String(selectedYear)}
                    >
                      {getYearOptions(5).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="winnerParticipantId" className="label">
                    Ganador
                  </label>
                  <select
                    id="winnerParticipantId"
                    name="winnerParticipantId"
                    className="select"
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

                <div>
                  <label htmlFor="drawDate" className="label">
                    Fecha del sorteo
                  </label>
                  <input
                    id="drawDate"
                    name="drawDate"
                    type="date"
                    className="input"
                    defaultValue={lastFriday}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="payoutRecordedAt" className="label">
                    Fecha de pago al ganador
                  </label>
                  <input
                    id="payoutRecordedAt"
                    name="payoutRecordedAt"
                    type="date"
                    className="input"
                  />
                  <p className="helper">
                    Déjalo vacío si aún no se ha entregado el dinero al ganador.
                  </p>
                </div>

                <div>
                  <label htmlFor="winnerNotes" className="label">
                    Observaciones
                  </label>
                  <textarea id="winnerNotes" name="notes" className="textarea" />
                </div>

                <SubmitButton label="Guardar ganador" pendingLabel="Guardando..." />
              </form>
            </div>

            <div className="panel">
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                Resumen histórico de polla
              </h3>
              <div className="table-wrap mt-6">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th>Recaudo</th>
                      <th>Ganador</th>
                      <th>Pago ganador</th>
                      <th>Saldo en caja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummaries.map((summary) => (
                      <tr key={`${summary.year}-${summary.month}`}>
                        <td>
                          <div className="font-semibold">
                            {formatMonthYear(summary.month, summary.year)}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                            Último viernes: {formatDate(summary.lastFriday)}
                          </div>
                        </td>
                        <td>{formatCurrency(summary.totalCollected)}</td>
                        <td>
                          {summary.winner ? (
                            <>
                              <div>{summary.winner.fullName}</div>
                              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                                Número ganador: #{summary.winningNumber}
                              </div>
                            </>
                          ) : summary.winnerPayout > 0 ? (
                            <>
                              <div>Pago histórico registrado</div>
                              {summary.payoutRecordedAt ? (
                                <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                                  Pago: {formatDate(summary.payoutRecordedAt)}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            "Pendiente"
                          )}
                        </td>
                        <td>{summary.winnerPayout > 0 ? formatCurrency(summary.winnerPayout) : "-"}</td>
                        <td>{formatCurrency(summary.commonFund)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
