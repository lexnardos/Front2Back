import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackofficeUpdateForm } from "@/components/backoffice-update-form";
import { CopyButton } from "@/components/copy-button";
import { DatosPlantilla } from "@/components/datos-plantilla";
import {
  IconArrowRight,
  IconChevronLeft,
  IconClock,
  IconFileText,
  IconShield,
  IconUser,
  IconUserCog,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { getSessionContext } from "@/lib/auth";
import { getPlantilla } from "@/lib/plantillas";
import type {
  CasoEscalamiento,
  HistorialMovimiento,
  Usuario,
} from "@/lib/types";
import { formatDateTime, isUuid } from "@/lib/utils";

interface CasoPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: CasoPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: isUuid(id) ? `Caso ${id.slice(0, 8)}` : "Caso",
    description: "Detalle y gestión de un escalamiento en F2B.",
  };
}

export default async function CasoDetallePage({ params }: CasoPageProps) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const { supabase } = await getSessionContext();

  const [casoRes, historialRes, analistasRes] = await Promise.all([
    supabase
      .from("casos_escalamiento")
      .select(
        "*, asignado:usuarios!casos_escalamiento_asignado_a_fkey(id, nombre_completo, correo)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("historial_movimientos")
      .select(
        "*, usuario:usuarios!historial_movimientos_usuario_id_fkey(id, nombre_completo, correo)",
      )
      .eq("caso_id", id)
      .order("fecha_movimiento", { ascending: true }),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("rol", "backoffice")
      .order("nombre_completo"),
  ]);

  const caso = casoRes.data as unknown as CasoEscalamiento | null;

  if (!caso) {
    notFound();
  }

  const plantilla = getPlantilla(caso.tipologia);

  const historial = (historialRes.data ??
    []) as unknown as HistorialMovimiento[];
  const analistas =
    (analistasRes.data as unknown as Array<
      Pick<Usuario, "id" | "nombre_completo">
    >) ?? [];

  return (
    <div>
      <Link
        href="/backoffice"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <IconChevronLeft className="h-4 w-4" />
        Volver a la bandeja
      </Link>

      <div className="mt-4 card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-brand-700">
                {caso.numero_radicado}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-medium text-slate-500">
                Caso F2B
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {caso.tipologia}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge estado={caso.estado} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                <IconClock className="h-3.5 w-3.5" />
                {caso.paso_actual}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <CopyButton value={caso.numero_radicado} label="Copiar radicado" />
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Creado por
            </dt>
            <dd className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <IconUser className="h-3.5 w-3.5 text-slate-400" />
              {caso.creado_por}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Fecha de creación
            </dt>
            <dd className="mt-1 text-xs font-medium text-slate-700">
              {formatDateTime(caso.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Última actualización
            </dt>
            <dd className="mt-1 text-xs font-medium text-slate-700">
              {formatDateTime(caso.updated_at)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Asignado a
            </dt>
            <dd className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <IconUserCog className="h-3.5 w-3.5 text-slate-400" />
              {caso.asignado?.nombre_completo ?? "Sin asignar"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <IconFileText className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Información de la plantilla
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {caso.tipologia}
              </span>
            </div>
            <div className="space-y-5 px-5 py-5 sm:px-6">
              {plantilla ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3">
                  <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs leading-5 text-amber-900">
                    {plantilla.descripcion}
                  </p>
                </div>
              ) : null}
              <DatosPlantilla
                tipologia={caso.tipologia}
                datos={caso.datos_plantilla}
              />
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Historial de movimientos
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Trazabilidad cronológica del caso.
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                {historial.length}{" "}
                {historial.length === 1 ? "movimiento" : "movimientos"}
              </span>
            </div>
            <div className="px-5 py-5 sm:px-6">
              <Timeline movimientos={historial} />
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <BackofficeUpdateForm
            casoId={caso.id}
            estadoActual={caso.estado}
            pasoActual={caso.paso_actual}
            asignadoA={caso.asignado_a}
            analistas={analistas}
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-100/60 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Flujo del caso
            </h2>
            <ol className="mt-3 space-y-2.5">
              {[
                "Pendiente",
                "En Proceso",
                "Completado",
                "Rechazado",
              ].map((estado) => (
                <li
                  key={estado}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-slate-500">{estado}</span>
                  {caso.estado === estado ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                      Actual
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </li>
              ))}
            </ol>
            <Link
              href={`/consulta?radicado=${encodeURIComponent(caso.numero_radicado)}`}
              className="mt-4 inline-flex items-center gap-1.5 border-t border-slate-200 pt-3 text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              Ver vista pública
              <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
