import { StatusBadge } from "@/components/status-badge";
import type { EstadoCaso } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export interface TimelineMovimiento {
  id: string;
  estado_anterior: EstadoCaso | null;
  estado_nuevo: EstadoCaso;
  paso_registrado: string;
  comentario: string | null;
  fecha_movimiento: string;
  usuario?: string | { nombre_completo?: string | null } | null;
}

const dotStyles: Record<EstadoCaso, string> = {
  Pendiente: "bg-amber-500 ring-amber-100",
  "En Proceso": "bg-sky-500 ring-sky-100",
  Completado: "bg-emerald-500 ring-emerald-100",
  Rechazado: "bg-rose-500 ring-rose-100",
};

function nombreUsuario(
  usuario: TimelineMovimiento["usuario"],
): string | null {
  if (!usuario) return null;
  if (typeof usuario === "string") return usuario;
  return usuario.nombre_completo ?? null;
}

export function Timeline({
  movimientos,
}: {
  movimientos: TimelineMovimiento[];
}) {
  if (movimientos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Aún no hay movimientos registrados.
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {movimientos.map((movimiento, index) => {
        const usuario = nombreUsuario(movimiento.usuario);
        const isLast = index === movimientos.length - 1;
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
                dotStyles[movimiento.estado_nuevo],
              )}
              aria-hidden
            />
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge estado={movimiento.estado_nuevo} size="sm" />
                  <span className="text-xs font-medium text-slate-500">
                    {movimiento.paso_registrado}
                  </span>
                </div>
                <time
                  dateTime={movimiento.fecha_movimiento}
                  className="text-[11px] font-medium text-slate-400"
                >
                  {formatDateTime(movimiento.fecha_movimiento)}
                </time>
              </div>

              {movimiento.estado_anterior &&
              movimiento.estado_anterior !== movimiento.estado_nuevo ? (
                <p className="mt-2 text-[11px] text-slate-400">
                  Cambio de estado: {movimiento.estado_anterior} →{" "}
                  {movimiento.estado_nuevo}
                </p>
              ) : null}

              {movimiento.comentario ? (
                <p className="mt-2.5 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-600">
                  {movimiento.comentario}
                </p>
              ) : null}

              {usuario ? (
                <p className="mt-2.5 text-[11px] font-medium text-slate-400">
                  Registrado por {usuario}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
