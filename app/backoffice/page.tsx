import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowRight,
  IconClock,
  IconInbox,
  IconSearch,
  IconUser,
} from "@/components/icons";
import { SlaCountdown } from "@/components/sla-countdown";
import { StatusBadge } from "@/components/status-badge";
import { getSessionContext } from "@/lib/auth";
import {
  ESTADOS_CASO,
  type CasoEscalamiento,
  type EstadoCaso,
} from "@/lib/types";
import {
  cn,
  formatDateOnly,
  formatDateTime,
  sanitizeSearchTerm,
  truncate,
} from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bandeja Backoffice",
  description: "Gestión de casos escalados desde Frontoffice.",
};

interface BackofficePageProps {
  searchParams: Promise<{ estado?: string; q?: string }>;
}

type FiltroEstado = EstadoCaso | "activos" | "todos";

const filtros: Array<{ value: FiltroEstado; label: string }> = [
  { value: "activos", label: "Activos" },
  { value: "Pendiente", label: "Pendientes" },
  { value: "En Proceso", label: "En proceso" },
  { value: "Completado", label: "Completados" },
  { value: "Rechazado", label: "Rechazados" },
  { value: "todos", label: "Todos" },
];

function esFiltroValido(value: string): value is FiltroEstado {
  return value === "activos" || value === "todos" || ESTADOS_CASO.includes(value as EstadoCaso);
}

function hrefConFiltro(estado: FiltroEstado, q: string): string {
  const params = new URLSearchParams();
  if (estado !== "activos") params.set("estado", estado);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/backoffice?${query}` : "/backoffice";
}

export default async function BackofficePage({
  searchParams,
}: BackofficePageProps) {
  const { estado: estadoParam, q: qParam } = await searchParams;
  const filtro: FiltroEstado =
    estadoParam && esFiltroValido(estadoParam) ? estadoParam : "activos";
  const q = sanitizeSearchTerm(qParam ?? "");
  const { supabase } = await getSessionContext();

  let casosQuery = supabase
    .from("casos_escalamiento")
    .select(
      "id, numero_radicado, tipologia, estado, paso_actual, creado_por, asignado_a, created_at, updated_at, sla_deadline, primera_respuesta_at, asignado:usuarios!casos_escalamiento_asignado_a_fkey(nombre_completo)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (filtro === "activos") {
    casosQuery = casosQuery.in("estado", ["Pendiente", "En Proceso"]);
  } else if (filtro !== "todos") {
    casosQuery = casosQuery.eq("estado", filtro);
  }

  if (q) {
    casosQuery = casosQuery.or(
      `numero_radicado.ilike.%${q}%,tipologia.ilike.%${q}%,creado_por.ilike.%${q}%`,
    );
  }

  const [casosRes, pendientesRes, procesoRes, completadosRes, rechazadosRes] =
    await Promise.all([
      casosQuery,
      supabase
        .from("casos_escalamiento")
        .select("*", { count: "exact", head: true })
        .eq("estado", "Pendiente"),
      supabase
        .from("casos_escalamiento")
        .select("*", { count: "exact", head: true })
        .eq("estado", "En Proceso"),
      supabase
        .from("casos_escalamiento")
        .select("*", { count: "exact", head: true })
        .eq("estado", "Completado"),
      supabase
        .from("casos_escalamiento")
        .select("*", { count: "exact", head: true })
        .eq("estado", "Rechazado"),
    ]);

  const casos = (casosRes.data ?? []) as unknown as CasoEscalamiento[];
  const counts = {
    Pendiente: pendientesRes.count ?? 0,
    "En Proceso": procesoRes.count ?? 0,
    Completado: completadosRes.count ?? 0,
    Rechazado: rechazadosRes.count ?? 0,
  };

  const stats = [
    {
      estado: "Pendiente" as const,
      label: "Pendientes",
      value: counts.Pendiente,
      className: "border-amber-200/70 bg-amber-50/70 text-amber-700",
    },
    {
      estado: "En Proceso" as const,
      label: "En proceso",
      value: counts["En Proceso"],
      className: "border-sky-200/70 bg-sky-50/70 text-sky-700",
    },
    {
      estado: "Completado" as const,
      label: "Completados",
      value: counts.Completado,
      className: "border-emerald-200/70 bg-emerald-50/70 text-emerald-700",
    },
    {
      estado: "Rechazado" as const,
      label: "Rechazados",
      value: counts.Rechazado,
      className: "border-rose-200/70 bg-rose-50/70 text-rose-700",
    },
  ];

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            Backoffice
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Bandeja de escalamientos
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Casos activos para validar, asignar y resolver.
          </p>
        </div>
        <Link href="/escalamiento" className="btn-secondary">
          Crear escalamiento
          <IconArrowRight className="h-4 w-4 text-slate-400" />
        </Link>
      </div>

      {casosRes.error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          No fue posible cargar la bandeja. Recarga la página o revisa la
          conexión con Supabase.
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.estado}
            href={hrefConFiltro(stat.estado, q)}
            className={cn(
              "rounded-xl border px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-sm",
              stat.className,
              filtro === stat.estado && "ring-2 ring-slate-900/10",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-6 card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
            {filtros.map((item) => (
              <Link
                key={item.value}
                href={hrefConFiltro(item.value, q)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  filtro === item.value
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <form
            action="/backoffice"
            method="get"
            className="flex items-center gap-2"
          >
            {filtro !== "activos" ? (
              <input type="hidden" name="estado" value={filtro} />
            ) : null}
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Buscar radicado, tipología o agente"
                className="field-input mt-0 w-full py-2 pl-9 pr-3 text-xs lg:w-72"
              />
            </div>
            <button type="submit" className="btn-secondary px-3 py-2 text-xs">
              Buscar
            </button>
            {q ? (
              <Link
                href={hrefConFiltro(filtro, "")}
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Limpiar
              </Link>
            ) : null}
          </form>
        </div>

        {casos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <IconInbox className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                No hay casos para este filtro
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {q
                  ? "Prueba con otro término de búsqueda."
                  : "Los nuevos escalamientos aparecerán aquí automáticamente."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Radicado</th>
                    <th className="px-4 py-3 font-semibold">Tipología</th>
                    <th className="px-4 py-3 font-semibold">Creado por</th>
                    <th className="px-4 py-3 font-semibold">Asignado</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">SLA</th>
                    <th className="px-4 py-3 font-semibold">Paso actual</th>
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {casos.map((caso) => (
                    <tr
                      key={caso.id}
                      className="group transition hover:bg-slate-50/70"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <Link
                          href={`/backoffice/${caso.id}`}
                          className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800"
                        >
                          {caso.numero_radicado}
                        </Link>
                      </td>
                      <td className="max-w-[180px] px-4 py-3.5">
                        <p className="truncate text-xs font-medium text-slate-700">
                          {caso.tipologia}
                        </p>
                      </td>
                      <td className="max-w-[150px] px-4 py-3.5">
                        <p className="truncate text-xs text-slate-500">
                          {caso.creado_por}
                        </p>
                      </td>
                      <td className="max-w-[150px] px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <IconUser className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">
                            {caso.asignado?.nombre_completo ?? "Sin asignar"}
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <StatusBadge estado={caso.estado} size="sm" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <SlaCountdown
                          compact
                          createdAt={caso.created_at}
                          slaDeadline={caso.sla_deadline}
                          primeraRespuestaAt={caso.primera_respuesta_at}
                          estado={caso.estado}
                          updatedAt={caso.updated_at}
                        />
                      </td>
                      <td className="max-w-[160px] px-4 py-3.5">
                        <p
                          className="truncate text-xs text-slate-500"
                          title={caso.paso_actual}
                        >
                          {truncate(caso.paso_actual, 32)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <IconClock className="h-3.5 w-3.5" />
                          {formatDateOnly(caso.created_at)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <Link
                          href={`/backoffice/${caso.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 transition group-hover:bg-white group-hover:text-brand-700"
                        >
                          Gestionar
                          <IconArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {casos.map((caso) => (
                <Link
                  key={caso.id}
                  href={`/backoffice/${caso.id}`}
                  className="block px-4 py-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-brand-700">
                        {caso.numero_radicado}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {caso.tipologia}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge estado={caso.estado} size="sm" />
                      <SlaCountdown
                        compact
                        createdAt={caso.created_at}
                        slaDeadline={caso.sla_deadline}
                        primeraRespuestaAt={caso.primera_respuesta_at}
                        estado={caso.estado}
                        updatedAt={caso.updated_at}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <IconUser className="h-3.5 w-3.5" />
                      {caso.creado_por}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconClock className="h-3.5 w-3.5" />
                      {formatDateTime(caso.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs text-slate-500">
                    Paso: {caso.paso_actual}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
