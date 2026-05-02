import { deleteCashAdjustmentAction, saveCashAdjustmentAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/layout/admin-shell";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { StatCard } from "@/components/ui/stat-card";
import { requireAdminSession } from "@/lib/auth";
import { buildCashMovements, calculateDashboardMetrics } from "@/lib/finance/calculations";
import { readDatabase } from "@/lib/store";
import { cashCategoryLabel, formatCurrency } from "@/lib/utils";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  success?: string | string[];
  error?: string | string[];
}>;

function getSearchParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CashPage(props: { searchParams: SearchParams }) {
  const session = await requireAdminSession();
  const database = await readDatabase();
  const searchParams = await props.searchParams;
  const metrics = calculateDashboardMetrics(database);
  const movements = buildCashMovements(database);

  return (
    <AdminShell
      title="Caja general"
      description="La caja principal refleja lo recaudado en aportes, polla, almuerzos, viaje e intereses, menos el capital prestado pendiente. Más abajo puedes auditar el balance completo por movimientos."
      username={session.username}
    >
      <FeedbackBanner
        success={getSearchParam(searchParams.success)}
        error={getSearchParam(searchParams.error)}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Caja disponible" value={metrics.availableCash} />
        <StatCard label="Total acumulado" value={metrics.grossCashPool} tone="success" />
        <StatCard label="Capital prestado pendiente" value={metrics.totalLoanedOut} tone="neutral" />
        <StatCard label="Balance por movimientos" value={metrics.movementCashBalance} tone="danger" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entradas reales" value={metrics.totalCashIn} tone="success" />
        <StatCard label="Salidas reales" value={metrics.totalCashOut} tone="danger" />
        <StatCard label="Pendiente por cobrar" value={metrics.totalPendingToCollect} tone="neutral" />
        <StatCard label="Fondo común" value={metrics.totalCommonFund} tone="success" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Aportes" value={metrics.totalContributionCollected} />
        <StatCard label="Polla en caja" value={metrics.totalRaffleBalance} tone="neutral" />
        <StatCard label="Almuerzos natillera" value={metrics.totalLunchCollected} tone="success" />
        <StatCard label="Almuerzos extras" value={metrics.totalLunchExtraSales} tone="neutral" />
        <StatCard label="Viaje Coveñas" value={metrics.totalTripCollected} tone="neutral" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="panel">
          <h3 className="text-xl font-semibold text-[var(--foreground)]">
            Ajuste manual autorizado
          </h3>
          <form action={saveCashAdjustmentAction} className="mt-6 grid gap-4">
            <div>
              <label htmlFor="date" className="label">
                Fecha
              </label>
              <input
                id="date"
                name="date"
                type="date"
                className="input"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>

            <div>
              <label htmlFor="type" className="label">
                Tipo
              </label>
              <select id="type" name="type" className="select">
                <option value="income">Ingreso</option>
                <option value="expense">Salida</option>
              </select>
            </div>

            <div>
              <label htmlFor="amount" className="label">
                Valor
              </label>
              <input id="amount" name="amount" type="number" min="0" className="input" required />
            </div>

            <div>
              <label htmlFor="description" className="label">
                Descripción
              </label>
              <textarea id="description" name="description" className="textarea" required />
            </div>

            <div>
              <label htmlFor="participantId" className="label">
                Participante relacionado
              </label>
              <select id="participantId" name="participantId" className="select">
                <option value="">Ninguno</option>
                {database.participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.fullName}
                  </option>
                ))}
              </select>
            </div>

            <SubmitButton label="Registrar ajuste" pendingLabel="Guardando..." />
          </form>
        </div>

        <div className="panel">
          <h3 className="text-xl font-semibold text-[var(--foreground)]">
            Historial de movimientos
          </h3>
          <div className="table-wrap mt-6">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Participante</th>
                  <th>Descripción</th>
                  <th>Valor</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const participant = database.participants.find(
                    (item) => item.id === movement.participantId,
                  );
                  const isManualAdjustment = movement.category === "adjustment";

                  return (
                    <tr key={movement.id}>
                      <td>{formatDateTime(movement.date)}</td>
                      <td>{movement.type === "income" ? "Ingreso" : "Salida"}</td>
                      <td>{cashCategoryLabel(movement.category)}</td>
                      <td>{participant?.fullName ?? "-"}</td>
                      <td>{movement.description}</td>
                      <td className={movement.type === "income" ? "text-emerald-700" : "text-rose-700"}>
                        {movement.type === "income" ? "+" : "-"}
                        {formatCurrency(movement.amount)}
                      </td>
                      <td>
                        {isManualAdjustment ? (
                          <form action={deleteCashAdjustmentAction}>
                            <input
                              type="hidden"
                              name="id"
                              value={movement.sourceId.replace(/^cash_adjustment_/, "")}
                            />
                            <ConfirmButton
                              label="Eliminar"
                              message="¿Eliminar este ajuste manual?"
                            />
                          </form>
                        ) : (
                          "Automático"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
