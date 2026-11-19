import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackofficeActionsPanel } from "@/components/backoffice-actions-panel";
import { CopyButton } from "@/components/copy-button";
import { DatosPlantilla } from "@/components/datos-plantilla";
import { EvidenceGallery } from "@/components/evidence-gallery";
import {
  IconArrowRight,
  IconChevronLeft,
  IconClock,
  IconFileText,
  IconShield,
  IconUser,
  IconUserCog,
} from "@/components/icons";
import { SlaCountdown } from "@/components/sla-countdown";
import { StatusBadge } from "@/components/status-badge";
import { Timeline, type TimelineMovimiento } from "@/components/timeline";
import { getSessionContext } from "@/lib/auth";
import { getPlantilla } from "@/lib/plantillas";
import type {
  CasoEscalamiento,
  Evidencia,
  Usuario,
} from "@/lib/types";
import { etiquetaEstado, ESTADOS_CASO } from "@/lib/types";
import { evidenciasDe, formatDateTime, isUuid } from "@/lib/utils";

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

  const { supabase, user } = await getSessionContext();

  const casoRes = await supabase
    .from("casos_escalamiento")
    .select(
      "*, asignado:usuarios!casos_escalamiento_asignado_a_fkey(id, nombre_completo, correo)",
    )
    .eq("id", id)
    .maybeSingle();

  let caso = casoRes.data as unknown as CasoEscalamiento | null;

  if (casoRes.error?.message.includes("does not exist")) {
    const legado = await supabase
      .from("casos_escalamiento")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    caso = legado.data as unknown as CasoEscalamiento | null;
  }

  if (!caso) {
    notFound();
  }

  const plantilla = getPlantilla(caso.tipologia);
  const evidencias = evidenciasDe(caso.datos_plantilla) as Evidencia[];

  const [auditoriaRes, analistasRes] = await Promise.all([
    supabase
      .from("ticket_historial")
      .select(
        "id, fecha_evento, usuario_nombre, rol, accion, estado_anterior, estado_nuevo, paso_registrado, observaciones, duracion_ms",
      )
      .eq("caso_id", id)
      .order("fecha_evento", { ascending: true }),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("rol", "backoffice")
      .order("nombre_completo"),
  ]);

  let historial: TimelineMovimiento[] = [];

  if (!auditoriaRes.error) {
    historial = (auditoriaRes.data ?? []).map((item) => ({
      id: item.id,
      fecha_movimiento: item.fecha_evento,
      usuario: item.usuario_nombre,
      rol: item.rol,
      accion: item.accion,
      estado_anterior: item.estado_anterior,
      estado_nuevo: item.estado_nuevo,
      paso_registrado: item.paso_registrado,
      comentario: item.observaciones,
      duracion_ms: item.duracion_ms,
    }));
  } else {
    const movimientos = await supabase
      .from("historial_movimientos")
      .select(
        "id, estado_anterior, estado_nuevo, paso_registrado, comentario, fecha_movimiento, usuario:usuarios!historial_movimientos_usuario_id_fkey(id, nombre_completo, rol)",
      )
      .eq("caso_id", id)
      .order("fecha_movimiento", { ascending: true });
    historial = (movimientos.data ?? []).map((item) => {
      const usuario = item.usuario as unknown as
        | { nombre_completo?: string; rol?: string }
        | null;
      return {
        id: item.id,
        estado_anterior: item.estado_anterior,
        estado_nuevo: item.estado_nuevo,
        paso_registrado: item.paso_registrado,
        comentario: item.comentario,
        fecha_movimiento: item.fecha_movimiento,
        usuario: usuario?.nombre_completo ?? "Sistema",
        rol: usuario?.rol ?? "sistema",
      };
    });
  }

  const analistas =
    (analistasRes.data as unknown as Array<
      Pick<Usuario, "id" | "nombre_completo">
    >) ?? [];

  const pausado = caso.estado === "Devuelto" || Boolean(caso.sla_pausado_desde);

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
              <span className="text-xs font-medium text-slate-500">Caso F2B</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {caso.tipologia}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge estado={caso.estado} mostrarEtiquetaOperativa />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                <IconClock className="h-3.5 w-3.5" />
                {caso.paso_actual}
              </span>
              <SlaCountdown
                compact
                createdAt={caso.created_at}
                slaDeadline={caso.sla_deadline}
                primeraRespuestaAt={caso.primera_respuesta_at}
                estado={caso.estado}
                updatedAt={caso.updated_at}
                pausado={pausado}
              />
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

        {caso.estado === "Devuelto" ? (
          <div className="mx-5 mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 sm:mx-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
              Devuelto al Frontoffice · SLA en pausa
            </p>
            <p className="mt-1 text-xs font-semibold text-rose-900">
              {caso.causal_devolucion ?? "Causal no registrada"}
            </p>
            <p className="mt-1 text-xs leading-5 text-rose-800">
              {caso.observacion_devolucion ?? "Sin observación registrada."}
            </p>
          </div>
        ) : null}
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
                  Evidencias adjuntas
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Haz clic para ampliar. Sin descargas obligatorias.
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                {evidencias.length}
              </span>
            </div>
            <div className="px-5 py-5 sm:px-6">
              <EvidenceGallery evidencias={evidencias} />
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Auditoría y trazabilidad
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Registro inmutable de cada acción sobre el caso.
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                {historial.length}
              </span>
            </div>
            <div className="px-5 py-5 sm:px-6">
              <Timeline movimientos={historial} fechaCreacion={caso.created_at} />
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <SlaCountdown
            createdAt={caso.created_at}
            slaDeadline={caso.sla_deadline}
            primeraRespuestaAt={caso.primera_respuesta_at}
            estado={caso.estado}
            updatedAt={caso.updated_at}
            pausado={pausado}
          />

          <BackofficeActionsPanel
            casoInicial={caso}
            usuarioId={user?.id ?? ""}
            analistas={analistas}
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-100/60 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Flujo del caso
            </h2>
            <ol className="mt-3 space-y-2.5">
              {ESTADOS_CASO.map((estado) => (
                <li
                  key={estado}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-slate-500">{etiquetaEstado(estado)}</span>
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
