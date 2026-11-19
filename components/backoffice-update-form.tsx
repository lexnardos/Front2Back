"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  IconCheck,
  IconFileText,
  IconUserCog,
} from "@/components/icons";
import { PASOS_SUGERIDOS } from "@/lib/plantillas";
import { ESTADOS_CASO, type ActualizarCasoState } from "@/lib/types";

const ESTADOS_EDITABLES = ESTADOS_CASO.filter((estado) => estado !== "Devuelto");
import { actualizarCaso } from "@/app/backoffice/actions";
import { cn } from "@/lib/utils";

interface Analista {
  id: string;
  nombre_completo: string;
}

interface BackofficeUpdateFormProps {
  casoId: string;
  estadoActual: string;
  pasoActual: string;
  asignadoA: string | null;
  analistas: Analista[];
  bloqueadoPor?: string | null;
}

export function BackofficeUpdateForm({
  casoId,
  estadoActual,
  pasoActual,
  asignadoA,
  analistas,
  bloqueadoPor,
}: BackofficeUpdateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActualizarCasoState | null>(null);

  if (estadoActual === "Devuelto") {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700">
            <IconFileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              Esperando subsanación
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              El caso está devuelto al Frontoffice. La gestión se reanuda cuando
              el asesor corrija y reenvíe la solicitud.
            </p>
          </div>
        </div>
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setState(null);
      try {
        const result = await actualizarCaso(formData);
        setState(result);
        if (result.ok) {
          router.refresh();
        }
      } catch {
        setState({
          ok: false,
          error:
            "No fue posible conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.",
        });
      }
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <IconUserCog className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            Gestión de Backoffice
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Actualiza el caso y registra la observación de gestión.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        <input type="hidden" name="caso_id" value={casoId} />

        {state?.error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-700"
          >
            {state.error}
          </div>
        ) : null}

        {state?.ok && state.message ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs leading-5 text-emerald-700"
          >
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {state.message}
          </div>
        ) : null}

        {bloqueadoPor ? (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800"
          >
            Este caso está en gestión por <span className="font-semibold">{bloqueadoPor}</span>.
            Libéralo o espera a que quede disponible para responder.
          </div>
        ) : null}

        <div>
          <label htmlFor="estado" className="field-label">
            Estado del caso
          </label>
          <select
            id="estado"
            name="estado"
            required
            defaultValue={estadoActual}
            className="field-select"
          >
            {ESTADOS_EDITABLES.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="paso_actual" className="field-label">
            Paso actual del proceso
          </label>
          <input
            id="paso_actual"
            name="paso_actual"
            type="text"
            required
            maxLength={120}
            defaultValue={pasoActual}
            list="pasos-sugeridos"
            placeholder="Ej. En revisión con área responsable"
            className="field-input"
          />
          <datalist id="pasos-sugeridos">
            {PASOS_SUGERIDOS.map((paso) => (
              <option key={paso} value={paso} />
            ))}
          </datalist>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-400">
            Puedes escribir un paso nuevo o elegir uno sugerido.
          </p>
        </div>

        <div>
          <label htmlFor="asignado_a" className="field-label">
            Asignar a
          </label>
          <select
            id="asignado_a"
            name="asignado_a"
            defaultValue={asignadoA ?? ""}
            className="field-select"
          >
            <option value="">Sin asignar</option>
            {analistas.map((analista) => (
              <option key={analista.id} value={analista.id}>
                {analista.nombre_completo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="comentario" className="field-label">
            Comentario de gestión
            <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
              (recomendado)
            </span>
          </label>
          <textarea
            id="comentario"
            name="comentario"
            rows={4}
            maxLength={2000}
            placeholder="Describe la validación, el avance o la decisión tomada."
            className="field-input min-h-[104px] resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || Boolean(bloqueadoPor)}
          className={cn("btn-primary w-full")}
        >
          {isPending ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
              Guardando gestión...
            </>
          ) : (
            <>
              <IconFileText className="h-4 w-4" />
              Guardar y registrar movimiento
            </>
          )}
        </button>

        <p className="text-[11px] leading-4 text-slate-400">
          Cada guardado crea una entrada inmutable en el historial de
          movimientos del caso.
        </p>
      </form>
    </div>
  );
}
