import type { Metadata } from "next";
import Link from "next/link";
import { GestionBoard } from "@/components/gestion-board";
import { IconChevronLeft } from "@/components/icons";
import { getSessionContext } from "@/lib/auth";
import type { CasoEscalamiento } from "@/lib/types";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Gestión de casos · Backoffice",
  description: "Tablero operativo de casos pendientes y en proceso.",
};

export const dynamic = "force-dynamic";

interface GestionPageProps {
  searchParams: Promise<{ estado?: string; caso?: string }>;
}

type FiltroGestion = "todos" | "Pendiente" | "En Proceso";

const SELECT_GESTION =
  "id, numero_radicado, tipologia, datos_plantilla, estado, paso_actual, creado_por, creado_por_id, asignado_a, assigned_to_id, assigned_to_name, locked_at, created_at, updated_at, sla_deadline, primera_respuesta_at, sla_pausado_desde, asignado:usuarios!casos_escalamiento_asignado_a_fkey(nombre_completo)";

const SELECT_GESTION_LEGADO =
  "id, numero_radicado, tipologia, datos_plantilla, estado, paso_actual, creado_por, creado_por_id, asignado_a, created_at, updated_at, asignado:usuarios!casos_escalamiento_asignado_a_fkey(nombre_completo)";

function filtroDesdeParametro(valor: string | undefined): FiltroGestion {
  if (valor === "pendientes" || valor === "Pendiente") return "Pendiente";
  if (valor === "en-proceso" || valor === "En Proceso") return "En Proceso";
  return "todos";
}

export default async function GestionPage({ searchParams }: GestionPageProps) {
  const { estado, caso } = await searchParams;
  const { supabase, user, perfil } = await getSessionContext();

  const consulta = supabase
    .from("casos_escalamiento")
    .select(SELECT_GESTION)
    .in("estado", ["Pendiente", "En Proceso"])
    .order("created_at", { ascending: false })
    .limit(500);

  const respuesta = await consulta;
  let casos: CasoEscalamiento[] = [];
  let aviso: string | null = null;

  if (!respuesta.error) {
    casos = (respuesta.data ?? []) as unknown as CasoEscalamiento[];
  } else if (/sla_deadline|primera_respuesta_at|42703|PGRST205/.test(respuesta.error.message)) {
    const legado = await supabase
      .from("casos_escalamiento")
      .select(SELECT_GESTION_LEGADO)
      .in("estado", ["Pendiente", "En Proceso"])
      .order("created_at", { ascending: false })
      .limit(500);
    casos = (legado.data ?? []) as unknown as CasoEscalamiento[];
    aviso = legado.error
      ? legado.error.message
      : "Faltan columnas de SLA. Aplica migration_f2b_completa.sql en Supabase.";
  } else {
    aviso = respuesta.error.message;
  }

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

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            Backoffice · Operación diaria
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Gestión de casos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Casos pendientes y en proceso, sincronizados en tiempo real. Toma un
            caso y trabájalo aquí mismo sin buscarlo en la bandeja.
          </p>
        </div>
        <Link href="/backoffice" className="btn-secondary self-start">
          <IconChevronLeft className="h-4 w-4 text-slate-500" />
          Volver a la bandeja
        </Link>
      </div>

      {aviso ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
        >
          {aviso}
        </div>
      ) : null}

      <GestionBoard
        casosIniciales={casos}
        usuarioId={user?.id ?? ""}
        nombreAnalista={perfil?.nombre_completo ?? ""}
        analistas={analistas}
        filtroInicial={filtroDesdeParametro(estado)}
        casoEnfocadoId={caso && isUuid(caso) ? caso : null}
      />
    </div>
  );
}
