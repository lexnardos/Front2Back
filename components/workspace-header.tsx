import Link from "next/link";
import { BackofficeNavLinks } from "@/components/backoffice-nav-links";
import { Brand } from "@/components/brand";
import { CallbackReminder } from "@/components/callback-reminder";
import { IconLogout, IconUser } from "@/components/icons";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileDialog } from "@/components/profile-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/login/actions";
import type { RolUsuario } from "@/lib/types";
import { cn } from "@/lib/utils";

type ActiveSection = "escalamiento" | "backoffice" | "consulta";

interface WorkspaceHeaderProps {
  nombre: string;
  correo: string;
  rol: RolUsuario;
  avatarUrl: string | null;
  active: ActiveSection;
  usuarioId?: string;
}

export function WorkspaceHeader({
  nombre,
  correo,
  rol,
  avatarUrl,
  active,
  usuarioId,
}: WorkspaceHeaderProps) {
  const links: Array<{ href: string; label: string; key: ActiveSection }> = [];
  links.push(
    { href: "/escalamiento", label: "Nuevo escalamiento", key: "escalamiento" },
    { href: "/consulta", label: "Consultar", key: "consulta" },
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/[0.85] backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-5">
          <Brand />
          <nav className="hidden items-center gap-0.5 sm:flex">
            {rol === "backoffice" ? <BackofficeNavLinks /> : null}
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  active === link.key
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <NotificationBell rol={rol} />
          {rol === "backoffice" ? (
            <ProfileDialog
              nombre={nombre}
              correo={correo}
              rol={rol}
              avatarUrl={avatarUrl}
            />
          ) : (
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-500">
                <IconUser className="h-4 w-4" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="max-w-[150px] truncate text-xs font-semibold text-slate-800">
                  {nombre}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {rol}
                </span>
              </span>
            </div>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
            >
              <IconLogout className="h-4 w-4" />
              Salir
            </button>
          </form>
        </div>

        <nav className="flex w-full items-center gap-0.5 overflow-x-auto pb-0.5 sm:hidden">
          {rol === "backoffice" ? <BackofficeNavLinks compacto /> : null}
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                active === link.key
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-500 hover:bg-slate-100",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {usuarioId ? <CallbackReminder usuarioId={usuarioId} /> : null}
    </header>
  );
}
