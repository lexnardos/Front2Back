import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight, IconDashboard, IconInbox } from "@/components/icons";
import { BackofficeBoard } from "@/components/backoffice-board";
import { GlobalSearch } from "@/components/global-search";
import { getSessionContext } from "@/lib/auth";
import {
  ESTADOS_CASO,
  type CasoBusqueda,
  type CasoEscalamiento,
  type EstadoCaso,
} from "@/lib/types";
import { cn, sanitizeSearchTerm } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bandeja Backoffice",
  description: "Gestión de casos escalados desde Frontoffice.",
};

export const dynamic = "force-dynamic";

interface BackofficePageProps {
  searchParams: Promise<{ estado?: string; q?: string }>;
}

type FiltroEstado = EstadoCaso | "activos" | "todos";

const filtros: Array<{ value: FiltroEstado; label: string }> = [
  { value: "activos", label: "Activos" },
  { value: "Pendiente", label: "Abiertos" },
  { value: "En Proceso", label: "En gestión" },
  { value: "Devuelto", label: "Devueltos" },
  { value: "Completado", label: "Resueltos" },
  { value: "Rechazado", label: "Cerrados" },
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

const SELECT_CASOS =
  "id, numero_radicado, tipologia, estado, paso_actual, creado_por, asignado_a, assigned_to_id, assigned_to_name, locked_at, created_at, updated_at, sla_deadline, primera_respuesta_at, sla_pausado_desde, asignado:usuarios!casos_escalamiento_asignado_a_fkey(nombre_completo)";

const SELECT_CASOS_LEGADO =
  "id, numero_radicado, tipologia, estado, paso_actual, creado_por, asignado_a, created_at, updated_at, asignado:usuarios!casos_escalamiento_asignado_a_fkey(nombre_completo)";

export default async function BackofficePage({
  searchParams,
}: BackofficePageProps) {
  const { estado: estadoParam, q: qParam } = await searchParams;
  const filtro: FiltroEstado =
    estadoParam && esFiltroValido(estadoParam) ? estadoParam : "activos";
  const q = sanitizeSearchTerm(qParam ?? "");
  const { supabase, user } = await getSessionContext();

  let casos: CasoEscalamiento[] = [];
  let aviso: string | null = null;

  if (q.length >= 2) {
    const { data, error } = await supabase.rpc("buscar_casos", {
      p_termino: q,
      p_limite: 100,
    });
    if (error) {
      aviso =
        "El buscador avanzado requiere la migración F2B. Usa la búsqueda por radicado mientras tanto.";
    } else {
      const encontrados = (data ?? []) as unknown as CasoBusqueda[];
      const ids = encontrados
        .filter((caso) => filtro === "todos" || (filtro === "activos" ? ["Pendiente", "En Proceso"].includes(caso.estado) : caso.estado === filtro))
        .slice(0, 100)
        .map((caso) => caso.id);

      if (ids.length > 0) {
        const detalle = await supabase
          .from("casos_escalamiento")
          .select(SELECT_CASOS)
          .in("id", ids)
          .order("created_at", { ascending: false });
        if (!detalle.error) {
          casos = (detalle.data ?? []) as unknown as CasoEscalamiento[];
        } else {
          const legado = await supabase
            .from("casos_escalamiento")
            .select(SELECT_CASOS_LEGADO)
            .in("id", ids)
            .order("created_at", { ascending: false });
          casos = (legado.data ?? []) as unknown as CasoEscalamiento[];
          aviso = "Faltan columnas de SLA. Aplica migration_f2b_completa.sql en Supabase.";
        }
      }
    }
  } else {
    let consulta = supabase
      .from("casos_escalamiento")
      .select(SELECT_CASOS)
      .order("created_at", { ascending: false })
      .limit(100);

    const filtroLocalDevuelto = filtro === "Devuelto";

    if (filtro === "activos") {
      consulta = consulta.in("estado", ["Pendiente", "En Proceso"]);
    } else if (filtro !== "todos" && !filtroLocalDevuelto) {
      consulta = consulta.eq("estado", filtro);
    }

    const respuesta = await consulta;
    if (!respuesta.error) {
      casos = (respuesta.data ?? []) as unknown as CasoEscalamiento[];
    } else if (/sla_deadline|primera_respuesta_at|42703|PGRST205/.test(respuesta.error.message)) {
      let consultaLegada = supabase
        .from("casos_escalamiento")
        .select(SELECT_CASOS_LEGADO)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filtro === "activos") {
        consultaLegada = consultaLegada.in("estado", ["Pendiente", "En Proceso"]);
      } else if (filtro !== "todos" && !filtroLocalDevuelto) {
        consultaLegada = consultaLegada.eq("estado", filtro);
      }
      const legado = await consultaLegada;
      casos = (legado.data ?? []) as unknown as CasoEscalamiento[];
      if (legado.error) aviso = legado.error.message;
      else aviso = "Faltan columnas de SLA. Aplica migration_f2b_completa.sql en Supabase.";
    } else {
      aviso = respuesta.error.message;
    }

    if (filtroLocalDevuelto) {
      casos = casos.filter((caso) => caso.estado === "Devuelto");
      if (!aviso) {
        aviso =
          "El estado Devuelto requiere la migración F2B. Aplica migration_f2b_completa.sql en Supabase.";
      }
    }
  }

  const { data: conteosData, error: conteosError } = await supabase
    .from("casos_escalamiento")
    .select("estado")
    .limit(5000);
  const conteoPorEstado = new Map<string, number>();
  (conteosData ?? []).forEach((fila) => {
    const estado = (fila as { estado?: string }).estado ?? "Desconocido";
    conteoPorEstado.set(estado, (conteoPorEstado.get(estado) ?? 0) + 1);
  });
  if (conteosError && !aviso) aviso = conteosError.message;

  const { data: analistasData } = await supabase
    .from("usuarios")
    .select("id, nombre_completo")
    .eq("rol", "backoffice")
    .order("nombre_completo");
  const analistas =
    (analistasData as unknown as Array<{
      id: string;
      nombre_completo: string;
    }>) ?? [];

  const stats = [
    { estado: "Pendiente" as const, label: "Abiertos", className: "border-amber-200/70 bg-amber-50/70 text-amber-700" },
    { estado: "En Proceso" as const, label: "En gestión", className: "border-sky-200/70 bg-sky-50/70 text-sky-700" },
    { estado: "Devuelto" as const, label: "Devueltos", className: "border-rose-200/70 bg-rose-50/70 text-rose-700" },
    { estado: "Completado" as const, label: "Resueltos", className: "border-emerald-200/70 bg-emerald-50/70 text-emerald-700" },
    { estado: "Rechazado" as const, label: "Cerrados", className: "border-slate-200/70 bg-slate-50 text-slate-700" },
  ].map((stat) => ({
    ...stat,
    value: conteoPorEstado.get(stat.estado) ?? 0,
  }));

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
            Casos activos para validar, asignar, devolver y resolver.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/backoffice/metricas" className="btn-secondary">
            <IconDashboard className="h-4 w-4 text-slate-500" />
            Métricas y reportes
          </Link>
          <Link href="/escalamiento" className="btn-secondary">
            Crear escalamiento
            <IconArrowRight className="h-4 w-4 text-slate-400" />
          </Link>
        </div>
      </div>

      {aviso ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
        >
          {aviso}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

          <div className="flex items-center gap-2">
            <div className="w-full lg:w-80">
              <GlobalSearch modo="backoffice" valorInicial={q} estado={filtro} />
            </div>
            {q ? (
              <Link
                href={hrefConFiltro(filtro, "")}
                className="shrink-0 text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Limpiar
              </Link>
            ) : null}
          </div>
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
          <BackofficeBoard
            casosIniciales={casos}
            usuarioId={user?.id ?? ""}
            analistas={analistas}
          />
        )}
      </div>
    </div>
  );
}
