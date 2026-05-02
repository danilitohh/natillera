import Link from "next/link";

import { AdminShell } from "@/components/layout/admin-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAdminSession } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/date";
import {
  buildAlerts,
  buildCashMovements,
  buildSettlementPreview,
  calculateDashboardMetrics,
} from "@/lib/finance/calculations";
import { readDatabase } from "@/lib/store";
import { cashCategoryLabel, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const database = await readDatabase();
  const metrics = calculateDashboardMetrics(database);
  const alerts = buildAlerts(database).slice(0, 8);
  const movements = buildCashMovements(database).slice(0, 10);
  const settlementPreview = buildSettlementPreview(database);
  const participantsWithDebt = settlementPreview.filter(
    (participant) => participant.outstandingDebt > 0,
  ).length;

  return (
    <AdminShell
      title="Dashboard"
      description="Vista consolidada de caja, pendientes, alertas y cierre proyectado de la natillera."
      username={session.username}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Caja disponible" value={metrics.availableCash} />
        <StatCard label="Total acumulado" value={metrics.grossCashPool} tone="success" />
        <StatCard label="Capital prestado" value={metrics.totalLoanedOut} tone="neutral" />
        <StatCard label="Pendiente por cobrar" value={metrics.totalPendingToCollect} tone="danger" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fondo común" value={metrics.totalCommonFund} tone="success" />
        <StatCard label="Balance por movimientos" value={metrics.movementCashBalance} tone="neutral" />
        <StatCard
          label="Intereses comunes"
          value={metrics.totalLateInterestCollected + metrics.totalLoanInterestCollected}
          tone="danger"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Aportes recibidos" value={metrics.totalContributionCollected} />
        <StatCard label="Polla en caja" value={metrics.totalRaffleBalance} tone="neutral" />
        <StatCard label="Almuerzos natillera" value={metrics.totalLunchCollected} tone="success" />
        <StatCard label="Almuerzos extras" value={metrics.totalLunchExtraSales} tone="neutral" />
        <StatCard label="Viaje Coveñas" value={metrics.totalTripCollected} tone="neutral" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                Alertas del sistema
              </h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Señales rápidas para revisar mora, vencimientos y liquidación próxima.
              </p>
            </div>
            <Link href="/admin/settlement" className="pill-link">
              Ver liquidación
            </Link>
          </div>

          <div className="mt-6 grid gap-3">
            {alerts.length === 0 ? (
              <EmptyState
                title="Todo al día"
                description="No hay alertas críticas registradas en este momento."
              />
            ) : (
              alerts.map((alert) => (
                <article
                  key={alert.id}
                  className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-semibold text-[var(--foreground)]">
                        {alert.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                        {alert.description}
                      </p>
                    </div>
                    <StatusBadge status={alert.severity} />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <h3 className="text-xl font-semibold text-[var(--foreground)]">
            Estado de la natillera
          </h3>
          <div className="mt-6 grid gap-4">
            <div className="rounded-[1.5rem] bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Configuración actual
              </p>
              <div className="mt-3 grid gap-2 text-sm text-[var(--foreground)]">
                <p>Nombre: {database.settings.name}</p>
                <p>Duración: {database.settings.durationMonths} meses</p>
                <p>Inicio: {formatDate(database.settings.startDate)}</p>
                <p>Finalización: {formatDate(database.settings.endDate)}</p>
                <p>Liquidación estimada: {formatDate(database.settings.estimatedSettlementDate)}</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Riesgo de cierre
              </p>
              <div className="mt-3 grid gap-2 text-sm text-[var(--foreground)]">
                <p>Participantes activos: {database.participants.filter((item) => item.active).length}</p>
                <p>Participantes con deuda para liquidación: {participantsWithDebt}</p>
                <p>Movimientos de caja: {movements.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              Últimos movimientos de caja
            </h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Entradas y salidas calculadas automáticamente desde pagos, préstamos, ajustes y liquidaciones.
            </p>
          </div>
          <Link href="/admin/cash" className="pill-link">
            Abrir caja
          </Link>
        </div>

        <div className="table-wrap mt-6">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatDateTime(movement.date)}</td>
                  <td>{movement.type === "income" ? "Ingreso" : "Salida"}</td>
                  <td>{cashCategoryLabel(movement.category)}</td>
                  <td>{movement.description}</td>
                  <td className={movement.type === "income" ? "text-emerald-700" : "text-rose-700"}>
                    {movement.type === "income" ? "+" : "-"}
                    {formatCurrency(movement.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
