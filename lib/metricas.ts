import type { createClient } from "@/lib/supabase/server";
import { etiquetaEstado, type CasoEscalamiento } from "@/lib/types";
import { escapeCsv, formatearDuracion, valorPlantilla } from "@/lib/utils";

type SupabaseServidor = Awaited<ReturnType<typeof createClient>>;

const SELECT_METRICAS =
  "id, numero_radicado, tipologia, estado, paso_actual, creado_por, creado_por_id, asignado_a, created_at, updated_at, sla_deadline, primera_respuesta_at, sla_pausado_desde, cerrado_en, causal_devolucion, observacion_devolucion, datos_plantilla, asignado:usuarios!casos_escalamiento_asignado_a_fkey(nombre_completo)";

const SELECT_METRICAS_LEGADO =
  "id, numero_radicado, tipologia, estado, paso_actual, creado_por, creado_por_id, asignado_a, created_at, updated_at, datos_plantilla, asignado:usuarios!casos_escalamiento_asignado_a_fkey(nombre_completo)";

export async function cargarCasosParaMetricas(
  supabase: SupabaseServidor,
): Promise<{ casos: CasoEscalamiento[]; aviso: string | null }> {
  const respuesta = await supabase
    .from("casos_escalamiento")
    .select(SELECT_METRICAS)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (!respuesta.error) {
    return { casos: (respuesta.data ?? []) as unknown as CasoEscalamiento[], aviso: null };
  }

  const legado = await supabase
    .from("casos_escalamiento")
    .select(SELECT_METRICAS_LEGADO)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (legado.error) {
    return { casos: [], aviso: legado.error.message };
  }

  return {
    casos: (legado.data ?? []) as unknown as CasoEscalamiento[],
    aviso: "Faltan columnas de SLA. Aplica migration_f2b_completa.sql en Supabase.",
  };
}

export interface FiltrosMetricas {
  desde: string;
  hasta: string;
  asesor: string;
}

export interface Metricas {
  total: number;
  activos: number;
  devueltos: number;
  resueltos: number;
  cerrados: number;
  finalizados: number;
  tasaResolucion: number;
  cumplimientoSla: number;
  conRespuesta: number;
  tiempoRespuestaPromedioMs: number | null;
  tiempoResolucionPromedioMs: number | null;
  porTipologia: Array<{ etiqueta: string; total: number; resueltos: number }>;
  porAsesor: Array<{ etiqueta: string; total: number; resueltos: number }>;
  porDia: Array<{ etiqueta: string; total: number }>;
}

type Parametro = string | string[] | undefined;

function valorParametro(valor: Parametro): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return typeof valor === "string" ? valor.trim() : "";
}

function fechaValida(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

export function parsearFiltros(
  params: Record<string, Parametro>,
): FiltrosMetricas {
  const desde = valorParametro(params.desde);
  const hasta = valorParametro(params.hasta);
  return {
    desde: fechaValida(desde) ? desde : "",
    hasta: fechaValida(hasta) ? hasta : "",
    asesor: valorParametro(params.asesor).slice(0, 80),
  };
}

export function filtrarCasos(
  casos: CasoEscalamiento[],
  filtros: FiltrosMetricas,
): CasoEscalamiento[] {
  const asesor = filtros.asesor.toLocaleLowerCase("es-CO");
  return casos.filter((caso) => {
    const dia = caso.created_at.slice(0, 10);
    if (filtros.desde && dia < filtros.desde) return false;
    if (filtros.hasta && dia > filtros.hasta) return false;
    if (
      asesor &&
      !caso.creado_por.toLocaleLowerCase("es-CO").includes(asesor) &&
      !caso.asignado?.nombre_completo
        ?.toLocaleLowerCase("es-CO")
        .includes(asesor)
    ) {
      return false;
    }
    return true;
  });
}

function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round(valores.reduce((suma, valor) => suma + valor, 0) / valores.length);
}

function agrupar(casos: CasoEscalamiento[], clave: (caso: CasoEscalamiento) => string) {
  const grupos = new Map<string, { total: number; resueltos: number }>();
  casos.forEach((caso) => {
    const etiqueta = clave(caso) || "Sin información";
    const grupo = grupos.get(etiqueta) ?? { total: 0, resueltos: 0 };
    grupo.total += 1;
    if (caso.estado === "Completado") grupo.resueltos += 1;
    grupos.set(etiqueta, grupo);
  });
  return Array.from(grupos.entries())
    .map(([etiqueta, grupo]) => ({ etiqueta, ...grupo }))
    .sort((a, b) => b.total - a.total);
}

export function calcularMetricas(casos: CasoEscalamiento[]): Metricas {
  const total = casos.length;
  const activos = casos.filter((caso) =>
    ["Pendiente", "En Proceso"].includes(caso.estado),
  ).length;
  const devueltos = casos.filter((caso) => caso.estado === "Devuelto").length;
  const resueltos = casos.filter((caso) => caso.estado === "Completado").length;
  const cerrados = casos.filter((caso) => caso.estado === "Rechazado").length;
  const finalizados = resueltos + cerrados;

  const respuestaMs: number[] = [];
  const resolucionMs: number[] = [];
  let conRespuesta = 0;
  let dentroDeSla = 0;

  casos.forEach((caso) => {
    const inicio = new Date(caso.created_at).getTime();
    const respuesta = caso.primera_respuesta_at
      ? new Date(caso.primera_respuesta_at).getTime()
      : Number.NaN;
    const limite = caso.sla_deadline
      ? new Date(caso.sla_deadline).getTime()
      : inicio + 72 * 60 * 60 * 1000;

    if (Number.isFinite(respuesta) && Number.isFinite(inicio)) {
      conRespuesta += 1;
      respuestaMs.push(Math.max(0, respuesta - inicio));
      if (respuesta <= limite) dentroDeSla += 1;
    }

    if (caso.cerrado_en) {
      const fin = new Date(caso.cerrado_en).getTime();
      if (Number.isFinite(fin) && Number.isFinite(inicio)) {
        resolucionMs.push(Math.max(0, fin - inicio));
      }
    }
  });

  const porDiaMap = new Map<string, number>();
  casos.forEach((caso) => {
    const dia = caso.created_at.slice(0, 10);
    porDiaMap.set(dia, (porDiaMap.get(dia) ?? 0) + 1);
  });
  const porDia = Array.from(porDiaMap.entries())
    .map(([etiqueta, totalDia]) => ({ etiqueta, total: totalDia }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
    .slice(-14);

  return {
    total,
    activos,
    devueltos,
    resueltos,
    cerrados,
    finalizados,
    tasaResolucion: total > 0 ? Math.round((resueltos / total) * 100) : 0,
    cumplimientoSla:
      conRespuesta > 0 ? Math.round((dentroDeSla / conRespuesta) * 100) : 0,
    conRespuesta,
    tiempoRespuestaPromedioMs: promedio(respuestaMs),
    tiempoResolucionPromedioMs: promedio(resolucionMs),
    porTipologia: agrupar(casos, (caso) => caso.tipologia),
    porAsesor: agrupar(casos, (caso) => caso.asignado?.nombre_completo || caso.creado_por),
    porDia,
  };
}

export function casosACsv(casos: CasoEscalamiento[]): string {
  const encabezados = [
    "radicado",
    "tipologia",
    "estado_interno",
    "estado_operativo",
    "creado_por",
    "asignado",
    "fecha_creacion",
    "fecha_actualizacion",
    "primera_respuesta",
    "sla_limite",
    "sla_pausado_desde",
    "fecha_cierre",
    "sla_cumplido",
    "tiempo_respuesta",
    "tiempo_resolucion",
    "paso_actual",
    "cuenta_o_min",
    "cedula",
    "orden_o_ot",
    "causal_devolucion",
    "observacion_devolucion",
  ];

  const filas = casos.map((caso) => {
    const inicio = new Date(caso.created_at).getTime();
    const respuesta = caso.primera_respuesta_at
      ? new Date(caso.primera_respuesta_at).getTime()
      : Number.NaN;
    const limite = caso.sla_deadline
      ? new Date(caso.sla_deadline).getTime()
      : inicio + 72 * 60 * 60 * 1000;
    const cumplido = Number.isFinite(respuesta) ? (respuesta <= limite ? "Sí" : "No") : "Sin respuesta";
    const cierre = caso.cerrado_en ? new Date(caso.cerrado_en).getTime() : Number.NaN;

    return [
      caso.numero_radicado,
      caso.tipologia,
      caso.estado,
      etiquetaEstado(caso.estado),
      caso.creado_por,
      caso.asignado?.nombre_completo ?? "Sin asignar",
      caso.created_at,
      caso.updated_at,
      caso.primera_respuesta_at,
      caso.sla_deadline,
      caso.sla_pausado_desde,
      caso.cerrado_en,
      cumplido,
      formatearDuracion(Number.isFinite(respuesta) ? respuesta - inicio : null),
      formatearDuracion(Number.isFinite(cierre) ? cierre - inicio : null),
      caso.paso_actual,
      valorPlantilla(caso.datos_plantilla, "cuenta_min", "cuenta", "numero_cuenta"),
      valorPlantilla(caso.datos_plantilla, "cedula", "cedula_cliente", "cedula_deudor"),
      valorPlantilla(
        caso.datos_plantilla,
        "orden_trabajo",
        "radicado_tickler_ot",
        "ot_lls",
        "orden",
        "otts",
        "orden_activacion",
      ),
      caso.causal_devolucion,
      caso.observacion_devolucion,
    ]
      .map(escapeCsv)
      .join(",");
  });

  return `\uFEFF${encabezados.map(escapeCsv).join(",")}\r\n${filas.join("\r\n")}\r\n`;
}
