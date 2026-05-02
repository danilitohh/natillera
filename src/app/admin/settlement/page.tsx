import {
  generateSettlementAction,
  markSettlementPaidAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/layout/admin-shell";
import { SubmitButton } from "@/components/forms/submit-button";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAdminSession } from "@/lib/auth";
import { buildSettlementPreview, calculateDashboardMetrics } from "@/lib/finance/calculations";
import { readDatabase } from "@/lib/store";
import { formatCurrency, settlementStatusLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  success?: string | string[];
  error?: string | string[];
}>;

function getSearchParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SettlementPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireAdminSession();
  const searchParams = await props.searchParams;
  const database = await readDatabase();
  const previews = buildSettlementPreview(database);
  const metrics = calculateDashboardMetrics(database);
  const totalToPay = previews.reduce(
    (total, preview) => total + Math.max(preview.finalAmount, 0),
    0,
  );
  const totalDebt = previews.reduce(
    (total, preview) => total + preview.outstandingDebt,
    0,
  );

  return (
    <AdminShell
      title="Liquidación final"
      description="El cierre combina ahorro individual, fondo común y deudas pendientes para proyectar el valor final de cada participante."
      username={session.username}
    >
      <FeedbackBanner
        success={getSearchParam(searchParams.success)}
        error={getSearchParam(searchParams.error)}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fondo común" value={metrics.totalCommonFund} tone="success" />
        <StatCard label="Total proyectado a pagar" value={totalToPay} />
        <StatCard label="Deudas pendientes" value={totalDebt} tone="danger" />
        <StatCard label="Participantes activos" value={previews.length} tone="neutral" />
      </section>

      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[var(--foreground)]">
              Resumen de liquidación
            </h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Genera o actualiza el resumen con base en el estado actual de aportes, polla, almuerzos, intereses y préstamos.
            </p>
          </div>
          <form action={generateSettlementAction}>
            <SubmitButton label="Generar resumen" pendingLabel="Generando..." />
          </form>
        </div>

        <div className="table-wrap mt-6">
          <table className="table">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Ahorro</th>
                <th>Parte fondo común</th>
                <th>Deudas</th>
                <th>Total final</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {previews.map((preview) => (
                <tr key={preview.participant.id}>
                  <td>{preview.participant.fullName}</td>
                  <td>{formatCurrency(preview.individualSavings)}</td>
                  <td>{formatCurrency(preview.commonFundShare)}</td>
                  <td>{formatCurrency(preview.outstandingDebt)}</td>
                  <td>{formatCurrency(preview.finalAmount)}</td>
                  <td>
                    <div className="flex flex-col gap-2">
                      <StatusBadge status={preview.status} />
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {settlementStatusLabel(preview.status)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <form action={markSettlementPaidAction}>
                      <input
                        type="hidden"
                        name="participantId"
                        value={preview.participant.id}
                      />
                      <SubmitButton
                        label={preview.outstandingDebt > 0 ? "Registrar deuda" : "Marcar pagado"}
                        pendingLabel="Guardando..."
                        className="px-3 py-2 text-xs"
                      />
                    </form>
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
