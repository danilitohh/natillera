import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatCard } from "@/components/ui/stat-card";
import { readDatabase } from "@/lib/store";
import { formatDate } from "@/lib/date";
import {
  buildParticipantSummaries,
  calculateDashboardMetrics,
} from "@/lib/finance/calculations";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  query?: string | string[];
}>;

function getSearchParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function Home(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const query = getSearchParam(searchParams.query).trim().toLowerCase();
  const database = await readDatabase();
  const metrics = calculateDashboardMetrics(database);
  const participantSummaries = buildParticipantSummaries(database);
  const filteredParticipants = query
    ? participantSummaries.filter((summary) =>
        summary.participant.fullName.toLowerCase().includes(query),
      )
    : participantSummaries.slice(0, 6);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 lg:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-600)]">
            {database.settings.status === "active" ? "Natillera activa" : "Natillera"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {database.settings.name}
          </h1>
        </div>
        <Link href="/login" className="pill-link">
          Ingreso administrador
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-10 lg:px-6">
        <section className="panel overflow-hidden">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm font-medium text-[var(--brand-600)]">
                Consulta pública
              </p>
              <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
                Caja clara, deudas visibles y liquidación estimada para cada participante.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
                Cualquier persona puede consultar el estado general de la natillera y buscar por nombre para revisar aportes, deudas, préstamos activos y liquidación estimada. Solo el administrador puede modificar la información.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] ring-1 ring-[var(--border)]">
                  Inicio: {formatDate(database.settings.startDate)}
                </span>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] ring-1 ring-[var(--border)]">
                  Cierre: {formatDate(database.settings.endDate)}
                </span>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] ring-1 ring-[var(--border)]">
                  Liquidación estimada: {formatDate(database.settings.estimatedSettlementDate)}
                </span>
              </div>
            </div>

            <div className="rounded-[1.75rem] bg-[linear-gradient(140deg,_rgba(17,24,39,0.96),_rgba(15,118,110,0.92))] p-6 text-white shadow-xl shadow-[rgba(15,118,110,0.22)]">
              <p className="text-sm uppercase tracking-[0.2em] text-white/65">
                Caja general
              </p>
              <p className="mt-4 text-4xl font-semibold tracking-tight">
                {formatCurrency(metrics.availableCash)}
              </p>
              <div className="mt-6 grid gap-3 text-sm text-white/75">
                <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
                  <span>Total acumulado</span>
                  <strong className="text-white">
                    {formatCurrency(metrics.grossCashPool)}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
                  <span>Total prestado actualmente</span>
                  <strong className="text-white">
                    {formatCurrency(metrics.totalLoanedOut)}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
                  <span>Total pendiente por cobrar</span>
                  <strong className="text-white">
                    {formatCurrency(metrics.totalPendingToCollect)}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
                  <span>Fondo común estimado</span>
                  <strong className="text-white">
                    {formatCurrency(metrics.totalCommonFund)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Aportes recaudados" value={metrics.totalContributionCollected} />
          <StatCard label="Polla en caja" value={metrics.totalRaffleBalance} tone="neutral" />
          <StatCard label="Almuerzos natillera" value={metrics.totalLunchCollected} tone="success" />
          <StatCard label="Almuerzos extras" value={metrics.totalLunchExtraSales} tone="neutral" />
          <StatCard label="Viaje Coveñas" value={metrics.totalTripCollected} tone="neutral" />
          <StatCard label="Intereses comunes" value={metrics.totalLateInterestCollected + metrics.totalLoanInterestCollected} tone="danger" />
        </section>

        <section className="panel">
          <SectionHeading
            title="Buscar participante"
            description="Consulta resumen individual de aportes, intereses, préstamos y valor estimado de liquidación."
          />

          <form className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="search"
              name="query"
              defaultValue={query}
              placeholder="Escribe el nombre del participante"
              className="input"
            />
            <button type="submit" className="pill-link justify-center px-6">
              Buscar
            </button>
          </form>

          <div className="mt-6 grid gap-4">
            {filteredParticipants.length === 0 ? (
              <EmptyState
                title="No encontramos coincidencias"
                description="Prueba con otro nombre o revisa la ortografía del participante."
              />
            ) : (
              filteredParticipants.map((summary) => (
                <article key={summary.participant.id} className="panel-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-[var(--foreground)]">
                        {summary.participant.fullName}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                        Ingreso: {formatDate(summary.participant.joinedAt)}
                        {summary.participant.phone ? ` • ${summary.participant.phone}` : ""}
                        {summary.participant.document ? ` • ${summary.participant.document}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--brand-700)]">
                      Estimado final: {formatCurrency(summary.estimatedSettlement)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Aportes
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {formatCurrency(summary.totalContributions)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Polla
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {formatCurrency(summary.totalRaffles)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Almuerzos
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {formatCurrency(summary.totalLunches)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Viaje Coveñas
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {formatCurrency(summary.totalTripSavings)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Intereses pagados
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {formatCurrency(summary.totalLateInterests)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Préstamos activos
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {summary.activeLoans}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Deuda pendiente
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {formatCurrency(summary.pendingDebt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 text-sm text-[var(--muted-foreground)]">
                    <span>Parte estimada del fondo común: {formatCurrency(summary.commonFundShare)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
