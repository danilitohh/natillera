import Link from "next/link";

import { logoutAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/layout/admin-nav";
import { SubmitButton } from "@/components/forms/submit-button";

interface AdminShellProps {
  title: string;
  description: string;
  username: string;
  children: React.ReactNode;
}

export function AdminShell({
  title,
  description,
  username,
  children,
}: AdminShellProps) {
  return (
    <div className="min-h-screen w-full bg-[var(--surface-2)]">
      <div className="grid min-h-screen w-full gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-white/60 bg-[var(--surface-1)] p-5 shadow-xl shadow-black/5 backdrop-blur lg:p-6">
          <div className="mb-6 rounded-[1.5rem] bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_45%),linear-gradient(135deg,_#0f766e,_#134e4a)] p-5 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-white/70">
              Natillera
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Panel administrativo</h1>
            <p className="mt-2 text-sm text-white/75">
              Gestiona caja, préstamos, aportes y liquidación final.
            </p>
          </div>

          <AdminNav />

          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Sesión activa
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {username}
            </p>
            <form action={logoutAction} className="mt-4">
              <SubmitButton
                label="Cerrar sesión"
                pendingLabel="Cerrando..."
                className="w-full bg-[var(--foreground)] hover:bg-[var(--foreground-strong)]"
              />
            </form>
          </div>

          <Link
            href="/"
            className="mt-4 inline-flex text-sm font-medium text-[var(--brand-600)] transition hover:text-[var(--brand-700)]"
          >
            Ir a vista pública
          </Link>
        </aside>

        <main className="grid gap-6 p-4 lg:p-6">
          <header className="rounded-[2rem] border border-white/60 bg-[var(--surface-1)] p-6 shadow-xl shadow-black/5">
            <p className="text-sm font-medium text-[var(--brand-600)]">Administración</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
              {description}
            </p>
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
