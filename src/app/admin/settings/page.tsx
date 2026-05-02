import { AdminShell } from "@/components/layout/admin-shell";
import { SubmitButton } from "@/components/forms/submit-button";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { requireAdminSession } from "@/lib/auth";
import { readDatabase } from "@/lib/store";
import { saveSettingsAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  success?: string | string[];
  error?: string | string[];
}>;

function getSearchParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SettingsPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireAdminSession();
  const searchParams = await props.searchParams;
  const database = await readDatabase();

  return (
    <AdminShell
      title="Configuración"
      description="Define nombre, fechas, duración y estado de la natillera. La liquidación se sugiere para la primera semana de diciembre."
      username={session.username}
    >
      <FeedbackBanner
        success={getSearchParam(searchParams.success)}
        error={getSearchParam(searchParams.error)}
      />

      <section className="panel">
        <form action={saveSettingsAction} className="grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label htmlFor="name" className="label">
              Nombre de la natillera
            </label>
            <input
              id="name"
              name="name"
              className="input"
              defaultValue={database.settings.name}
              required
            />
          </div>

          <div>
            <label htmlFor="startDate" className="label">
              Fecha de inicio
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="input"
              defaultValue={database.settings.startDate}
              required
            />
          </div>

          <div>
            <label htmlFor="endDate" className="label">
              Fecha de finalización
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="input"
              defaultValue={database.settings.endDate}
              required
            />
          </div>

          <div>
            <label htmlFor="estimatedSettlementDate" className="label">
              Fecha estimada de liquidación
            </label>
            <input
              id="estimatedSettlementDate"
              name="estimatedSettlementDate"
              type="date"
              className="input"
              defaultValue={database.settings.estimatedSettlementDate}
              required
            />
            <p className="helper">
              Por defecto se recomienda la primera semana de diciembre.
            </p>
          </div>

          <div>
            <label htmlFor="status" className="label">
              Estado
            </label>
            <select
              id="status"
              name="status"
              className="select"
              defaultValue={database.settings.status}
            >
              <option value="active">Activa</option>
              <option value="finished">Finalizada</option>
              <option value="settled">Liquidada</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-[1.5rem] bg-slate-50 p-5">
              <p className="text-sm text-[var(--muted-foreground)]">
                Duración calculada automáticamente
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {database.settings.durationMonths} meses
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <SubmitButton label="Guardar configuración" pendingLabel="Guardando..." />
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
