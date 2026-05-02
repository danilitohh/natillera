import Link from "next/link";

import { AdminShell } from "@/components/layout/admin-shell";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { StatCard } from "@/components/ui/stat-card";
import { SubmitButton } from "@/components/forms/submit-button";
import { requireAdminSession } from "@/lib/auth";
import { buildParticipantSummaries } from "@/lib/finance/calculations";
import { readDatabase } from "@/lib/store";
import { formatDate } from "@/lib/date";
import {
  saveParticipantAction,
  toggleParticipantAction,
} from "@/app/admin/actions";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  success?: string | string[];
  error?: string | string[];
  edit?: string | string[];
}>;

function getSearchParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ParticipantsPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireAdminSession();
  const database = await readDatabase();
  const searchParams = await props.searchParams;
  const editId = getSearchParam(searchParams.edit);
  const editingParticipant = database.participants.find(
    (participant) => participant.id === editId,
  );
  const summaries = buildParticipantSummaries(database);
  const activeCount = database.participants.filter((item) => item.active).length;

  return (
    <AdminShell
      title="Participantes"
      description="Registra participantes, actualiza su información y controla si siguen activos en la natillera."
      username={session.username}
    >
      <FeedbackBanner
        success={getSearchParam(searchParams.success)}
        error={getSearchParam(searchParams.error)}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Participantes activos" value={activeCount} />
        <StatCard label="Participantes totales" value={database.participants.length} tone="neutral" />
        <StatCard
          label="Con deuda estimada"
          value={summaries.filter((summary) => summary.pendingDebt > 0).length}
          tone="danger"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
        <div className="panel">
          <h3 className="text-xl font-semibold text-[var(--foreground)]">
            {editingParticipant ? "Editar participante" : "Nuevo participante"}
          </h3>
          <form action={saveParticipantAction} className="mt-6 grid gap-4">
            <input type="hidden" name="id" value={editingParticipant?.id ?? ""} />

            <div>
              <label htmlFor="fullName" className="label">
                Nombre completo
              </label>
              <input
                id="fullName"
                name="fullName"
                className="input"
                defaultValue={editingParticipant?.fullName}
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Teléfono
              </label>
              <input
                id="phone"
                name="phone"
                className="input"
                defaultValue={editingParticipant?.phone}
              />
            </div>

            <div>
              <label htmlFor="document" className="label">
                Documento
              </label>
              <input
                id="document"
                name="document"
                className="input"
                defaultValue={editingParticipant?.document}
              />
            </div>

            <div>
              <label htmlFor="joinedAt" className="label">
                Fecha de ingreso
              </label>
              <input
                id="joinedAt"
                name="joinedAt"
                type="date"
                className="input"
                defaultValue={editingParticipant?.joinedAt ?? new Date().toISOString().slice(0, 10)}
                required
              />
            </div>

            <div>
              <label htmlFor="active" className="label">
                Estado
              </label>
              <select
                id="active"
                name="active"
                className="select"
                defaultValue={String(editingParticipant?.active ?? true)}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <SubmitButton
                label={editingParticipant ? "Guardar cambios" : "Registrar participante"}
                pendingLabel="Guardando..."
              />
              {editingParticipant ? (
                <Link href="/admin/participants" className="pill-link">
                  Cancelar edición
                </Link>
              ) : null}
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                Listado de participantes
              </h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Cada ficha mantiene trazabilidad para aportes, almuerzos, polla y préstamos.
              </p>
            </div>
          </div>

          {database.participants.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Aún no hay participantes"
                description="Registra el primero para empezar a llevar el control mensual."
              />
            </div>
          ) : (
            <div className="table-wrap mt-6">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Ingreso</th>
                    <th>Estado</th>
                    <th>Resumen</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {database.participants
                    .slice()
                    .sort((left, right) =>
                      left.fullName.localeCompare(right.fullName, "es"),
                    )
                    .map((participant) => {
                      const summary = summaries.find(
                        (item) => item.participant.id === participant.id,
                      );

                      return (
                        <tr key={participant.id}>
                          <td>
                            <div className="font-semibold">{participant.fullName}</div>
                            <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                              {participant.phone || "Sin teléfono"}
                              {participant.document ? ` • ${participant.document}` : ""}
                            </div>
                          </td>
                          <td>{formatDate(participant.joinedAt)}</td>
                          <td>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                participant.active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {participant.active ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td>
                            <div className="text-sm">
                              <div>Ahorro: {summary ? summary.totalContributions.toLocaleString("es-CO") : 0}</div>
                              <div>Deuda: {summary ? summary.pendingDebt.toLocaleString("es-CO") : 0}</div>
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/admin/participants?edit=${participant.id}`}
                                className="pill-link"
                              >
                                Editar
                              </Link>
                              <Link
                                href={`/admin/participants/${participant.id}`}
                                className="pill-link"
                              >
                                Ver ficha
                              </Link>
                              <form action={toggleParticipantAction}>
                                <input
                                  type="hidden"
                                  name="participantId"
                                  value={participant.id}
                                />
                                <input
                                  type="hidden"
                                  name="active"
                                  value={String(!participant.active)}
                                />
                                <button type="submit" className="pill-link">
                                  {participant.active ? "Desactivar" : "Activar"}
                                </button>
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
    </AdminShell>
  );
}
