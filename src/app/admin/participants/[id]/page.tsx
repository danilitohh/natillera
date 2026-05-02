import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAdminSession } from "@/lib/auth";
import { formatDate, formatMonthYear } from "@/lib/date";
import {
  buildParticipantSummaries,
  getContributionSnapshot,
  getLoanSnapshot,
  getLunchSnapshot,
  getRaffleSnapshot,
  getTripSnapshot,
} from "@/lib/finance/calculations";
import { readDatabase } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{
  id: string;
}>;

export default async function ParticipantDetailPage(props: { params: Params }) {
  const session = await requireAdminSession();
  const params = await props.params;
  const database = await readDatabase();
  const participant = database.participants.find((item) => item.id === params.id);

  if (!participant) {
    notFound();
  }

  const summary = buildParticipantSummaries(database).find(
    (item) => item.participant.id === participant.id,
  );
  const contributions = database.monthlyContributions
    .filter((record) => record.participantId === participant.id)
    .map((record) => getContributionSnapshot(record))
    .sort((left, right) =>
      `${right.record.year}-${String(right.record.month).padStart(2, "0")}`.localeCompare(
        `${left.record.year}-${String(left.record.month).padStart(2, "0")}`,
      ),
    );
  const raffles = database.raffleEntries
    .filter((record) => record.participantId === participant.id)
    .map((record) => getRaffleSnapshot(record));
  const lunches = database.lunches
    .filter((record) => record.participantId === participant.id)
    .map((record) => getLunchSnapshot(record));
  const trips = database.tripContributions
    .filter((record) => record.participantId === participant.id)
    .map((record) => getTripSnapshot(record));
  const loans = database.loans
    .filter((loan) => loan.participantId === participant.id)
    .map((loan) => getLoanSnapshot(loan, database.loanInstallments));

  return (
    <AdminShell
      title={participant.fullName}
      description="Ficha individual con historial de aportes, pagos fijos, préstamos y saldo estimado."
      username={session.username}
    >
      <div className="flex justify-between">
        <Link href="/admin/participants" className="pill-link">
          Volver a participantes
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ahorro individual" value={summary?.totalContributions ?? 0} />
        <StatCard label="Deuda pendiente" value={summary?.pendingDebt ?? 0} tone="danger" />
        <StatCard label="Liquidación estimada" value={summary?.estimatedSettlement ?? 0} tone="success" />
        <StatCard label="Parte del fondo común" value={summary?.commonFundShare ?? 0} tone="neutral" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel">
          <h3 className="text-xl font-semibold text-[var(--foreground)]">
            Datos básicos
          </h3>
          <div className="mt-5 grid gap-3 text-sm">
            <p>Estado: {participant.active ? "Activo" : "Inactivo"}</p>
            <p>Fecha de ingreso: {formatDate(participant.joinedAt)}</p>
            <p>Teléfono: {participant.phone || "No registrado"}</p>
            <p>Documento: {participant.document || "No registrado"}</p>
            <p>Préstamos activos: {summary?.activeLoans ?? 0}</p>
          </div>
        </div>

        <div className="panel">
          <h3 className="text-xl font-semibold text-[var(--foreground)]">
            Resumen financiero
          </h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Polla aportada
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrency(summary?.totalRaffles ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Almuerzos aportados
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrency(summary?.totalLunches ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Viaje Coveñas
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrency(summary?.totalTripSavings ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Intereses de mora
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrency(summary?.totalLateInterests ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Total deuda
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrency(summary?.pendingDebt ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="text-xl font-semibold text-[var(--foreground)]">
          Aportes mensuales
        </h3>
        <div className="table-wrap mt-6">
          <table className="table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Cuota</th>
                <th>Pagado</th>
                <th>Mora</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((snapshot) => (
                <tr key={snapshot.record.id}>
                  <td>{formatMonthYear(snapshot.record.month, snapshot.record.year)}</td>
                  <td>{formatCurrency(snapshot.record.quotaAmount)}</td>
                  <td>{formatCurrency(snapshot.record.amountPaid)}</td>
                  <td>{formatCurrency(snapshot.lateInterestDue)}</td>
                  <td>
                    <StatusBadge status={snapshot.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel">
          <h3 className="text-xl font-semibold text-[var(--foreground)]">
            Polla, almuerzos y viaje
          </h3>
          <div className="table-wrap mt-6">
            <table className="table">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Periodo</th>
                  <th>Pagado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {raffles.map((snapshot) => (
                  <tr key={snapshot.record.id}>
                    <td>Polla #{snapshot.record.selectedNumber}</td>
                    <td>{formatMonthYear(snapshot.record.month, snapshot.record.year)}</td>
                    <td>{formatCurrency(snapshot.record.amountPaid)}</td>
                    <td>
                      <StatusBadge status={snapshot.status} />
                    </td>
                  </tr>
                ))}
                {lunches.map((snapshot) => (
                  <tr key={snapshot.record.id}>
                    <td>Almuerzos</td>
                    <td>{formatMonthYear(snapshot.record.month, snapshot.record.year)}</td>
                    <td>{formatCurrency(snapshot.record.amountPaid)}</td>
                    <td>
                      <StatusBadge status={snapshot.status} />
                    </td>
                  </tr>
                ))}
                {trips.map((snapshot) => (
                  <tr key={snapshot.record.id}>
                    <td>Viaje Coveñas</td>
                    <td>{formatMonthYear(snapshot.record.month, snapshot.record.year)}</td>
                    <td>{formatCurrency(snapshot.record.amountPaid)}</td>
                    <td>
                      <StatusBadge status={snapshot.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h3 className="text-xl font-semibold text-[var(--foreground)]">
            Préstamos
          </h3>
          <div className="mt-6 grid gap-4">
            {loans.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                Este participante no tiene préstamos registrados.
              </p>
            ) : (
              loans.map((loan) => (
                <article key={loan.loan.id} className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-semibold text-[var(--foreground)]">
                        Préstamo del {formatDate(loan.loan.issuedAt)}
                      </h4>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {loan.loan.installmentCount} cuotas • Interés {Math.round(loan.loan.monthlyInterestRate * 100)}%
                      </p>
                    </div>
                    <StatusBadge status={loan.status === "paid" ? "paid" : loan.status === "overdue" ? "overdue" : "partial"} />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    <p>Monto prestado: {formatCurrency(loan.loan.principalAmount)}</p>
                    <p>Intereses generados: {formatCurrency(loan.totalInterestGenerated)}</p>
                    <p>Saldo pendiente: {formatCurrency(loan.totalOutstanding)}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
