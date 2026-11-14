import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { IconLock, IconSearch, IconShield } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { login } from "@/app/login/actions";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso para agentes y analistas de Backoffice de F2B.",
  robots: { index: false, follow: false },
};

const errorMessages: Record<string, string> = {
  "faltan-datos": "Ingresa tu correo y contraseña.",
  credenciales: "Correo o contraseña incorrectos. Inténtalo nuevamente.",
  "sin-perfil":
    "Tu usuario existe en Auth, pero no tiene perfil en F2B. Contacta al administrador.",
  configuracion:
    "La conexión con Supabase no está configurada. Revisa las variables de entorno.",
  error: "No fue posible iniciar sesión. Inténtalo nuevamente.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? errorMessages.error : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand />
        <Link
          href="/consulta"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-900"
        >
          <IconSearch className="h-4 w-4" />
          Consultar radicado
        </Link>
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-4 sm:px-6">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft lg:grid-cols-[1fr_1.05fr]">
          <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-8 text-white lg:flex">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(99,102,241,0.45),transparent_42%),radial-gradient(circle_at_85%_85%,rgba(14,165,233,0.3),transparent_40%)]"
            />
            <div className="relative">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-sm font-bold ring-1 ring-white/[0.15]">
                F2B
              </span>
              <h1 className="mt-8 text-3xl font-semibold tracking-tight">
                Control operativo, de punta a punta.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
                Ingresa para radicar escalamientos o gestionar la bandeja de
                Backoffice con trazabilidad completa.
              </p>
            </div>

            <ul className="relative mt-10 space-y-4">
              <li className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-brand-200 ring-1 ring-white/10">
                  <IconShield className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Acceso por rol</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Agentes y Backoffice ven únicamente lo que necesitan.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-brand-200 ring-1 ring-white/10">
                  <IconLock className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Sesión segura</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Autenticación administrada por Supabase Auth.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="p-6 sm:p-10">
            <div className="lg:hidden">
              <Brand />
            </div>

            <div className="mt-6 lg:mt-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                Acceso interno
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Inicia sesión en F2B
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Usa las credenciales asignadas por el administrador.
              </p>
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
              >
                {errorMessage}
              </div>
            ) : null}

            <form action={login} className="mt-6 space-y-4">
              {next ? <input type="hidden" name="next" value={next} /> : null}

              <div>
                <label htmlFor="email" className="field-label">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nombre@empresa.com"
                  className="field-input"
                />
              </div>

              <div>
                <label htmlFor="password" className="field-label">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="field-input"
                />
              </div>

              <div className="pt-1">
                <SubmitButton pendingText="Ingresando...">
                  Ingresar al panel
                </SubmitButton>
              </div>
            </form>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-5 text-xs text-slate-400">
              <Link href="/" className="font-medium hover:text-slate-600">
                Volver al inicio
              </Link>
              <span className="inline-flex items-center gap-1.5">
                <IconLock className="h-3.5 w-3.5" />
                Conexión cifrada
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
