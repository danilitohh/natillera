import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/login/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import {
  adminUsesFallbackCredentials,
  getAdminSession,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  success?: string | string[];
  error?: string | string[];
  next?: string | string[];
}>;

function getSearchParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LoginPage(props: {
  searchParams: SearchParams;
}) {
  const session = await getAdminSession();

  if (session) {
    redirect("/admin");
  }

  const searchParams = await props.searchParams;
  const success = getSearchParam(searchParams.success);
  const error = getSearchParam(searchParams.error);
  const next = getSearchParam(searchParams.next) || "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl shadow-black/8 lg:grid-cols-[1fr_420px]">
        <section className="hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.16),_transparent_30%),linear-gradient(140deg,_#eff6f1,_#ffffff)] p-10 lg:block">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-600)]">
            Natillera
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
            Administración segura para tu fondo familiar.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-[var(--muted-foreground)]">
            Desde aquí el administrador registra participantes, pagos, préstamos, alertas y liquidaciones. La vista pública sigue abierta solo para consulta.
          </p>

          <div className="mt-8 grid gap-4">
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Roles claros
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Solo el admin puede crear, editar o eliminar información. Cualquier visitante puede consultar caja y buscar participantes.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Cálculos centralizados
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Mora, polla, préstamos, caja y liquidación final se calculan desde servicios reutilizables del lado del servidor.
              </p>
            </div>
          </div>
        </section>

        <section className="p-8 sm:p-10">
          <Link href="/" className="text-sm font-medium text-[var(--brand-600)] hover:text-[var(--brand-700)]">
            Volver a consulta pública
          </Link>

          <div className="mt-8">
            <p className="text-sm font-medium text-[var(--brand-600)]">
              Ingreso administrador
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              Inicia sesión
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Usa las credenciales configuradas en variables de entorno para acceder al panel de control.
            </p>
          </div>

          <div className="mt-6">
            <FeedbackBanner success={success} error={error} />
          </div>

          {adminUsesFallbackCredentials() ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
              Modo desarrollo: si todavía no configuraste variables de entorno, el usuario por defecto es <strong>admin</strong> y la clave <strong>natillera123</strong>. Cámbialas antes de usar la app en producción.
            </div>
          ) : null}

          <form action={loginAction} className="mt-8 grid gap-5">
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="username" className="label">
                Usuario
              </label>
              <input
                id="username"
                name="username"
                className="input"
                placeholder="Administrador"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <SubmitButton label="Entrar al panel" pendingLabel="Validando..." className="mt-2 w-full py-3" />
          </form>
        </section>
      </div>
    </div>
  );
}
