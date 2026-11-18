import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconFileText,
  IconSearch,
  IconShield,
  IconTicket,
} from "@/components/icons";
import { PublicHeader } from "@/components/public-header";
import { SlaCountdown } from "@/components/sla-countdown";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { WorkspaceHeader } from "@/components/workspace-header";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ConsultaRadicado, Usuario } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Consultar radicado",
  description:
    "Consulta el estado, historial y observaciones de un escalamiento F2B.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const estadoDescripcion: Record<string, string> = {
  Pendiente:
    "El caso fue radicado y está en cola de revisión por parte de Backoffice.",
  "En Proceso":
    "El equipo de Backoffice está validando la información o aplicando el ajuste.",
  Completado:
    "La gestión terminó y la resolución fue registrada. Revisa las observaciones del historial.",
  Rechazado:
    "El caso no pudo ser gestionado. Revisa el comentario de Backoffice para conocer el motivo.",
};

interface ConsultaPageProps {
  searchParams: Promise<{ radicado?: string }>;
}

export default async function ConsultaPage({
  searchParams,
}: ConsultaPageProps) {
  const { radicado } = await searchParams;
  const radicadoBuscado =
    typeof radicado === "string" ? radicado.trim() : "";

  let perfil: Usuario | null = null;

  try {
    const session = await getSessionContext();
    perfil = session.user && session.perfil ? session.perfil : null;
  } catch {
    perfil = null;
  }

  let consulta: ConsultaRadicado | null = null;
  let error: string | null = null;

  if (radicadoBuscado) {
    try {
      const supabase = await createClient();
      const { data, error: rpcError } = await supabase.rpc(
        "consultar_radicado",
        { p_radicado: radicadoBuscado },
      );

      if (rpcError) {
        error =
          "No fue posible consultar el radicado en este momento. Inténtalo nuevamente.";
      } else {
        const raw = data as unknown as ConsultaRadicado | null;
        consulta = raw && raw.caso ? raw : null;
      }
    } catch {
      error =
        "La conexión con Supabase no está configurada. Revisa las variables de entorno.";
    }
  }

  return (
    <div className="min-h-screen">
      {perfil ? (
        <WorkspaceHeader
          nombre={perfil.nombre_completo}
          correo={perfil.correo}
          rol={perfil.rol}
          avatarUrl={perfil.avatar_url}
          active="consulta"
        />
      ) : (
        <PublicHeader />
      )}

      <section className="relative overflow-hidden border-b border-slate-200/70 bg-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(99,102,241,0.13),transparent_35%),radial-gradient(circle_at_90%_20%,rgba(14,165,233,0.1),transparent_35%)]"
        />
        <div className="relative mx-auto w-full max-w-4xl px-4 py-12 text-center sm:px-6 sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
            <IconSearch className="h-3.5 w-3.5" />
            Consulta de radicado
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Conoce el estado de tu escalamiento
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Ingresa el número de radicado para ver la trazabilidad, las fechas
            y las observaciones registradas por Backoffice.
          </p>

          <form
            action="/consulta"
            method="get"
            className="mx-auto mt-7 flex w-full max-w-xl flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="radicado"
                defaultValue={radicadoBuscado}
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="Ej. ESC-2026-0001"
                aria-label="Número de radicado"
                className="field-input mt-0 py-3 pl-11 pr-4 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case lg:text-base"
              />
            </div>
            <button type="submit" className="btn-primary px-5 py-3">
              Consultar
              <IconArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-3 text-[11px] text-slate-400">
            El radicado tiene el formato ESC-AÑO-CONSECUTIVO.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
          >
            {error}
          </div>
        ) : null}

        {!radicadoBuscado ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <IconTicket className="h-4 w-4" />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-slate-900">
                Radica el caso
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                Frontoffice crea el escalamiento y recibe un radicado único.
              </p>
            </div>
            <div className="card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-700">
                <IconClock className="h-4 w-4" />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-slate-900">
                Backoffice gestiona
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                Cada cambio de estado o paso queda guardado en el historial.
              </p>
            </div>
            <div className="card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <IconShield className="h-4 w-4" />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-slate-900">
                Consulta el avance
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                Usa el radicado para revisar la línea de tiempo completa.
              </p>
            </div>
          </div>
        ) : null}

        {radicadoBuscado && !error && !consulta ? (
          <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <IconSearch className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                No encontramos el radicado
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                Verifica que el número{" "}
                <span className="font-mono font-semibold text-slate-700">
                  {radicadoBuscado}
                </span>{" "}
                esté escrito correctamente e inténtalo de nuevo.
              </p>
            </div>
            <Link href="/consulta" className="btn-secondary">
              Realizar otra consulta
            </Link>
          </div>
        ) : null}

        {consulta ? (
          <div className="animate-fade-up space-y-6">
            <div className="card overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Radicado
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-slate-950">
                    {consulta.caso.numero_radicado}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    {consulta.caso.tipologia}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <StatusBadge estado={consulta.caso.estado} />
                  <CopyButton
                    value={consulta.caso.numero_radicado}
                    label="Copiar radicado"
                    copiedLabel="Copiado"
                  />
                </div>
              </div>

              <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-3 sm:px-6">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Paso actual
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-800">
                    {consulta.caso.paso_actual}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Fecha de creación
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-700">
                    {formatDateTime(consulta.caso.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Última actualización
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-700">
                    {formatDateTime(consulta.caso.updated_at)}
                  </dd>
                </div>
              </dl>

              <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                <SlaCountdown
                  createdAt={consulta.caso.created_at}
                  slaDeadline={consulta.caso.sla_deadline}
                  primeraRespuestaAt={consulta.caso.primera_respuesta_at}
                  estado={consulta.caso.estado}
                  updatedAt={consulta.caso.updated_at}
                />
              </div>

              <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
                <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <IconFileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {estadoDescripcion[consulta.caso.estado]}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <section className="card">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Línea de tiempo
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Movimientos y observaciones del caso.
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                    {consulta.historial.length}
                  </span>
                </div>
                <div className="px-5 py-5 sm:px-6">
                  <Timeline movimientos={consulta.historial} />
                </div>
              </section>

              <aside className="space-y-4">
                <div className="card p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Resumen
                  </h2>
                  <dl className="mt-4 space-y-3">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-slate-400">
                        Estado actual
                      </dt>
                      <dd className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          estado={consulta.caso.estado}
                          size="sm"
                        />
                        <SlaCountdown
                          compact
                          createdAt={consulta.caso.created_at}
                          slaDeadline={consulta.caso.sla_deadline}
                          primeraRespuestaAt={consulta.caso.primera_respuesta_at}
                          estado={consulta.caso.estado}
                          updatedAt={consulta.caso.updated_at}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-slate-400">
                        Radicado por
                      </dt>
                      <dd className="mt-1 text-xs font-medium text-slate-700">
                        {consulta.caso.creado_por}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-slate-400">
                        Movimientos
                      </dt>
                      <dd className="mt-1 text-xs font-medium text-slate-700">
                        {consulta.historial.length} registrados
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-5">
                  <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                    <IconCheck className="h-4 w-4" />
                    Consulta segura
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-emerald-800/80">
                    Esta vista no expone correos ni la información sensible de
                    la plantilla del caso.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row",
            !radicadoBuscado && "mt-12",
          )}
        >
          <p>F2B · Trazabilidad operativa Frontoffice–Backoffice.</p>
          <div className="flex items-center gap-4">
            <Link href="/escalamiento" className="hover:text-slate-600">
              Crear escalamiento
            </Link>
            {perfil ? (
              <Link
                href={perfil.rol === "backoffice" ? "/backoffice" : "/escalamiento"}
                className="hover:text-slate-600"
              >
                {perfil.rol === "backoffice" ? "Bandeja" : "Mi panel"}
              </Link>
            ) : (
              <Link href="/login" className="hover:text-slate-600">
                Acceso interno
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
