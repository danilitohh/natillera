import Link from "next/link";

import { deleteLunchAction, saveLunchAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/layout/admin-shell";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LUNCH_FIXED_AMOUNT, MONTH_OPTIONS } from "@/lib/constants";
import { requireAdminSession } from "@/lib/auth";
import {
  formatDate,
  formatMonthYear,
  getCurrentMonth,
  getCurrentYear,
  getYearOptions,
} from "@/lib/date";
import {
  buildLunchExtraSales,
  calculateDashboardMetrics,
  getLunchSnapshot,
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

export default async function LunchesPage(props: { searchParams: SearchParams }) {
  const session = await requireAdminSession();
  const searchParams = await props.searchParams;
  const database = await readDatabase();
  const editId = getSearchParam(searchParams.edit);
  const selectedMonth = Number(getSearchParam(searchParams.month) || getCurrentMonth());
  const selectedYear = Number(getSearchParam(searchParams.year) || getCurrentYear());
  const participants = database.participants.filter((participant) => participant.active);
  const editingRecord = database.lunches.find((record) => record.id === editId);
  const metrics = calculateDashboardMetrics(database);
  const extraSales = buildLunchExtraSales(database);
  const records = database.lunches
    .filter((record) => record.month === selectedMonth && record.year === selectedYear)
    .map((record) => getLunchSnapshot(record));

  return (
    <AdminShell
      title="Almuerzos"
      description="Cada participante aporta $5.000 mensuales a este fondo. Todo lo recaudado se reparte al final en partes iguales."
      username={session.username}
    >
      <FeedbackBanner
        success={getSearchParam(searchParams.success)}
        error={getSearchParam(searchParams.error)}
      />

      {participants.length === 0 ? (
        <EmptyState
          title="Necesitas participantes activos"
          description="Registra participantes antes de cargar aportes de almuerzos."
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard label="Almuerzos natillera" value={metrics.totalLunchCollected} />
            <StatCard label="Almuerzos extras" value={metrics.totalLunchExtraSales} tone="neutral" />
            <StatCard label="Total almuerzos" value={metrics.totalLunchCombined} tone="success" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="panel">
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                {editingRecord ? "Editar registro" : "Registrar almuerzo"}
              </h3>

              <form action={saveLunchAction} className="mt-6 grid gap-4">
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

                <div>
                  <label htmlFor="amountPaid" className="label">
                    Valor pagado
                  </label>
                  <input
                    id="amountPaid"
                    name="amountPaid"
                    type="number"
                    min="0"
                    max={LUNCH_FIXED_AMOUNT}
                    className="input"
                    defaultValue={editingRecord?.amountPaid ?? LUNCH_FIXED_AMOUNT}
                    required
                  />
                  <p className="helper">Valor fijo sugerido: {formatCurrency(LUNCH_FIXED_AMOUNT)}</p>
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
                    label={editingRecord ? "Guardar registro" : "Registrar almuerzo"}
                    pendingLabel="Guardando..."
                  />
                  {editingRecord ? (
                    <Link href={`/admin/lunches?month=${selectedMonth}&year=${selectedYear}`} className="pill-link">
                      Cancelar
                    </Link>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="grid gap-6">
              <div className="panel">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--foreground)]">
                      Registros por periodo
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      Todo lo recaudado aquí alimenta el fondo común de liquidación.
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

                {records.length === 0 ? (
                  <div className="mt-6">
                    <EmptyState
                      title="Sin registros para este periodo"
                      description="Registra los aportes de almuerzos del mes actual."
                    />
                  </div>
                ) : (
                  <div className="table-wrap mt-6">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Participante</th>
                          <th>Periodo</th>
                          <th>Pagado</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((snapshot) => {
                          const participant = database.participants.find(
                            (item) => item.id === snapshot.record.participantId,
                          );

                          return (
                            <tr key={snapshot.record.id}>
                              <td>{participant?.fullName}</td>
                              <td>{formatMonthYear(snapshot.record.month, snapshot.record.year)}</td>
                              <td>{formatCurrency(snapshot.record.amountPaid)}</td>
                              <td>
                                <StatusBadge status={snapshot.status} />
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-2">
                                  <Link
                                    href={`/admin/lunches?edit=${snapshot.record.id}&month=${selectedMonth}&year=${selectedYear}`}
                                    className="pill-link"
                                  >
                                    Editar
                                  </Link>
                                  <form action={deleteLunchAction}>
                                    <input type="hidden" name="id" value={snapshot.record.id} />
                                    <ConfirmButton
                                      label="Eliminar"
                                      message="¿Eliminar este registro de almuerzos?"
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

              <div className="panel">
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  Almuerzos extras vendidos
                </h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Estos ingresos vienen de invitados externos y ya estaban registrados en caja.
                </p>

                {extraSales.length === 0 ? (
                  <div className="mt-6">
                    <EmptyState
                      title="Sin ventas extras registradas"
                      description="Cuando registres ventas de almuerzos externas en caja, se verán aquí."
                    />
                  </div>
                ) : (
                  <div className="table-wrap mt-6">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Detalle</th>
                          <th>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extraSales.map((sale) => (
                          <tr key={sale.id}>
                            <td>{formatDate(sale.date)}</td>
                            <td>{sale.description}</td>
                            <td>{formatCurrency(sale.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
