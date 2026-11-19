import { StatusBadge } from "@/components/status-badge";
import { esEstadoFinal, etiquetaEstado, type EstadoCaso } from "@/lib/types";
import { cn, formatearDuracion, formatDateTime } from "@/lib/utils";

export interface TimelineMovimiento {
  id: string;
  estado_anterior: EstadoCaso | null;
  estado_nuevo: EstadoCaso;
  paso_registrado?: string | null;
  comentario: string | null;
  fecha_movimiento: string;
  usuario?: string | { nombre_completo?: string | null } | null;
  rol?: string | null;
  accion?: string | null;
  duracion_ms?: number | null;
}

const dotStyles: Record<EstadoCaso, string> = {
  Pendiente: "bg-amber-500 ring-amber-100",
  "En Proceso": "bg-sky-500 ring-sky-100",
  Completado: "bg-emerald-500 ring-emerald-100",
  Rechazado: "bg-slate-500 ring-slate-100",
  Devuelto: "bg-rose-500 ring-rose-100",
};

function nombreUsuario(usuario: TimelineMovimiento["usuario"]): string {
  if (!usuario) return "Sistema";
  if (typeof usuario === "string") return usuario;
  return usuario.nombre_completo ?? "Sistema";
}

function etiquetaRol(rol: string | null | undefined): string {
  if (rol === "backoffice") return "Backoffice";
  if (rol === "agente") return "Frontoffice";
  return "Sistema";
}

export function Timeline({
  movimientos,
  fechaCreacion,
}: {
  movimientos: TimelineMovimiento[];
  fechaCreacion?: string;
}) {
  if (movimientos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Aún no hay movimientos registrados.
      </p>
    );
  }

  const inicio = fechaCreacion
    ? new Date(fechaCreacion).getTime()
    : new Date(movimientos[0].fecha_movimiento).getTime();

  return (
    <ol className="space-y-0">
      {movimientos.map((movimiento, index) => {
        const usuario = nombreUsuario(movimiento.usuario);
        const isLast = index === movimientos.length - 1;
        const estado = (movimiento.estado_nuevo in dotStyles
          ? movimiento.estado_nuevo
          : "Pendiente") as EstadoCaso;
        const fecha = new Date(movimiento.fecha_movimiento).getTime();
        const transcurrido =
          movimiento.duracion_ms ??
          (Number.isFinite(fecha) && Number.isFinite(inicio)
            ? Math.max(0, fecha - inicio)
            : null);
        const mostrarTiempo =
          esEstadoFinal(estado) || (isLast && movimiento.duracion_ms !== null && movimiento.duracion_ms !== undefined);

        return (
          <li
            key={movimiento.id}
            className={cn("relative pl-8", isLast ? "pb-0" : "pb-7")}
          >
            {!isLast ? (
              <span
                className="absolute left-[5px] top-5 h-full w-px bg-slate-200"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "absolute left-0 top-1.5 h-3 w-3 rounded-full ring-4",
                dotStyles[estado],
              )}
              aria-hidden
            />
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge estado={estado} size="sm" mostrarEtiquetaOperativa />
                  <span className="text-xs font-medium text-slate-500">
                    {movimiento.accion ?? "Actualización de gestión"}
                  </span>
                </div>
                <time
                  dateTime={movimiento.fecha_movimiento}
                  className="text-[11px] font-medium text-slate-400"
                >
                  {formatDateTime(movimiento.fecha_movimiento)}
                </time>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span className="font-medium text-slate-500">{usuario}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-500">
                  {etiquetaRol(movimiento.rol)}
                </span>
                {movimiento.paso_registrado ? (
                  <span>{movimiento.paso_registrado}</span>
                ) : null}
              </div>

              {movimiento.estado_anterior &&
              movimiento.estado_anterior !== movimiento.estado_nuevo ? (
                <p className="mt-2 text-[11px] text-slate-400">
                  Cambio de estado: {etiquetaEstado(movimiento.estado_anterior)} →{" "}
                  {etiquetaEstado(movimiento.estado_nuevo)}
                </p>
              ) : null}

              {movimiento.comentario ? (
                <p className="mt-2.5 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-600">
                  {movimiento.comentario}
                </p>
              ) : null}

              {mostrarTiempo && transcurrido !== null ? (
                <p className="mt-2.5 text-[11px] font-semibold text-brand-700">
                  Tiempo total: {formatearDuracion(transcurrido)}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
