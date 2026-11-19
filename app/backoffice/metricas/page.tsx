import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  IconArrowRight,
  IconChevronLeft,
  IconClock,
  IconDashboard,
  IconFileText,
  IconShield,
  IconTicket,
} from "@/components/icons";
import { getSessionContext } from "@/lib/auth";
import {
  calcularMetricas,
  cargarCasosParaMetricas,
  filtrarCasos,
  parsearFiltros,
} from "@/lib/metricas";
import { cn, formatearDuracion, formatDateOnly } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Métricas Backoffice",
  description: "Indicadores operativos y exportación CSV de escalamientos F2B.",
};

export const dynamic = "force-dynamic";

interface MetricasPageProps {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    asesor?: string;
  }>;
}

function Barra({
  etiqueta,
  valor,
  total,
  secondary,
}: {
  etiqueta: string;
  valor: number;
  total: number;
  secondary?: number;
}) {
  const ancho = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-medium text-slate-600" title={etiqueta}>
          {etiqueta}
        </span>
        <span className="shrink-0 font-semibold text-slate-800">
          {valor}
          {secondary !== undefined ? (
            <span className="ml-1 font-normal text-emerald-600">
              ({secondary} resueltos)
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full",
            secondary !== undefined ? "bg-brand-500" : "bg-slate-400",
          )}
          style={{ width: `${ancho}%` }}
        />
      </div>
    </div>
  );
}

export default async function MetricasPage({ searchParams }: MetricasPageProps) {
  const { perfil, supabase } = await getSessionContext();
  if (!perfil || perfil.rol !== "backoffice") {
    redirect("/backoffice");
  }

  const filtros = parsearFiltros(await searchParams);
  const { casos, aviso } = await cargarCasosParaMetricas(supabase);
  const filtrados = filtrarCasos(casos, filtros);
  const metricas = calcularMetricas(filtrados);

  const query = new URLSearchParams();
  if (filtros.desde) query.set("desde", filtros.desde);
  if (filtros.hasta) query.set("hasta", filtros.hasta);
  if (filtros.asesor) query.set("asesor", filtros.asesor);
  const queryString = query.toString();
  const hrefExport = queryString
    ? `/backoffice/metricas/export?${queryString}`
    : "/backoffice/metricas/export";

  const tarjetas = [
    {
      label: "Casos en periodo",
      valor: String(metricas.total),
      detalle: "radicados en el filtro seleccionado",
      icono: IconTicket,
      tono: "text-brand-700 bg-brand-50",
    },
    {
      label: "Activos",
      valor: String(metricas.activos),
      detalle: "abiertos o en gestión",
      icono: IconClock,
      tono: "text-sky-700 bg-sky-50",
    },
    {
      label: "Devueltos",
      valor: String(metricas.devueltos),
      detalle: "SLA en pausa",
      icono: IconFileText,
      tono: "text-rose-700 bg-rose-50",
    },
    {
      label: "Resueltos",
      valor: String(metricas.resueltos),
      detalle: `${metricas.cerrados} cerrados sin resolución`,
      icono: IconShield,
      tono: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "Tasa de resolución",
      valor: `${metricas.tasaResolucion}%`,
      detalle: "sobre casos del periodo",
      icono: IconDashboard,
      tono: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "Cumplimiento SLA",
      valor: `${metricas.cumplimientoSla}%`,
      detalle: `${metricas.conRespuesta} con primera respuesta`,
      icono: IconClock,
      tono: "text-amber-700 bg-amber-50",
    },
    {
      label: "Primera respuesta",
      valor: formatearDuracion(metricas.tiempoRespuestaPromedioMs),
      detalle: "promedio desde la radicación",
      icono: IconClock,
      tono: "text-slate-700 bg-slate-100",
    },
    {
      label: "Tiempo de cierre",
      valor: formatearDuracion(metricas.tiempoResolucionPromedioMs),
      detalle: "promedio hasta cierre",
      icono: IconDashboard,
      tono: "text-slate-700 bg-slate-100",
    },
  ];

  return (
    <div>
      <Link
        href="/backoffice"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <IconChevronLeft className="h-4 w-4" />
        Volver a la bandeja
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            Backoffice · Reportes
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Métricas operativas
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Volumen, SLA, devoluciones y tiempos de gestión por tipología y analista.
          </p>
        </div>
        <a href={hrefExport} className="btn-primary">
          <IconFileText className="h-4 w-4" />
          Exportar CSV
        </a>
      </div>

      {aviso ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
        >
          {aviso}
        </div>
      ) : null}

      <form action="/backoffice/metricas" method="get" className="card mt-6">
        <div className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-4 md:items-end">
          <div>
            <label htmlFor="desde" className="field-label">
              Desde
            </label>
            <input
              id="desde"
              type="date"
              name="desde"
              defaultValue={filtros.desde}
              className="field-input mt-0"
            />
          </div>
          <div>
            <label htmlFor="hasta" className="field-label">
              Hasta
            </label>
            <input
              id="hasta"
              type="date"
              name="hasta"
              defaultValue={filtros.hasta}
              className="field-input mt-0"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="asesor" className="field-label">
              Asesor o analista
            </label>
            <input
              id="asesor"
              type="search"
              name="asesor"
              defaultValue={filtros.asesor}
              placeholder="Nombre del creador o asignado"
              className="field-input mt-0"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
          <p className="text-[11px] text-slate-400">
            {filtros.desde || filtros.hasta || filtros.asesor
              ? `Filtros activos · ${filtrados.length} de ${casos.length} casos`
              : `Mostrando los últimos ${casos.length} casos disponibles`}
          </p>
          <div className="flex items-center gap-2">
            <Link href="/backoffice/metricas" className="btn-secondary">
              Limpiar
            </Link>
            <button type="submit" className="btn-primary">
              Aplicar filtros
              <IconArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>

      {metricas.total === 0 ? (
        <div className="card mt-6 px-6 py-16 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <IconDashboard className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-700">
            No hay casos en el periodo seleccionado
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Ajusta las fechas o el asesor para ver resultados.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tarjetas.map((tarjeta) => {
              const Icono = tarjeta.icono;
              return (
                <div key={tarjeta.label} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {tarjeta.label}
                    </p>
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                        tarjeta.tono,
                      )}
                    >
                      <Icono className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    {tarjeta.valor}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">
                    {tarjeta.detalle}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="card">
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-slate-900">
                  Casos por tipología
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Distribución del volumen radicado.
                </p>
              </div>
              <div className="space-y-4 px-5 py-5 sm:px-6">
                {metricas.porTipologia.slice(0, 8).map((item) => (
                  <Barra
                    key={item.etiqueta}
                    etiqueta={item.etiqueta}
                    valor={item.total}
                    total={metricas.total}
                  />
                ))}
              </div>
            </section>

            <section className="card">
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-slate-900">
                  Casos por analista
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Carga asignada y casos resueltos.
                </p>
              </div>
              <div className="space-y-4 px-5 py-5 sm:px-6">
                {metricas.porAsesor.slice(0, 8).map((item) => (
                  <Barra
                    key={item.etiqueta}
                    etiqueta={item.etiqueta}
                    valor={item.total}
                    total={metricas.total}
                    secondary={item.resueltos}
                  />
                ))}
              </div>
            </section>

            <section className="card">
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-slate-900">
                  Radicaciones por día
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Últimos {metricas.porDia.length} días con movimiento.
                </p>
              </div>
              <div className="space-y-4 px-5 py-5 sm:px-6">
                {metricas.porDia.map((item) => (
                  <Barra
                    key={item.etiqueta}
                    etiqueta={formatDateOnly(item.etiqueta)}
                    valor={item.total}
                    total={Math.max(...metricas.porDia.map((dia) => dia.total), 1)}
                  />
                ))}
              </div>
            </section>
          </div>

          <section className="card mt-6 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-slate-900">
                Detalle por tipología
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Tipología</th>
                    <th className="px-4 py-3 font-semibold">Casos</th>
                    <th className="px-4 py-3 font-semibold">Participación</th>
                    <th className="px-4 py-3 font-semibold">Resueltos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metricas.porTipologia.map((item) => (
                    <tr key={item.etiqueta}>
                      <td className="px-5 py-3 text-xs font-medium text-slate-700">
                        {item.etiqueta}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                        {item.total}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {Math.round((item.total / metricas.total) * 100)}%
                      </td>
                      <td className="px-4 py-3 text-xs text-emerald-700">
                        {item.resueltos}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
