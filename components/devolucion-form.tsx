"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { IconCheck, IconFileText } from "@/components/icons";
import { devolverCaso } from "@/app/backoffice/actions";
import { CAUSALES_DEVOLUCION, type ActualizarCasoState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DevolucionForm({
  casoId,
  bloqueadoPor,
}: {
  casoId: string;
  bloqueadoPor?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActualizarCasoState | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("caso_id", casoId);
    setState(null);

    startTransition(async () => {
      try {
        const resultado = await devolverCaso(formData);
        setState(resultado);
        if (resultado.ok) {
          event.currentTarget.reset();
          router.refresh();
        }
      } catch {
        setState({
          ok: false,
          error: "No fue posible conectar con el servidor. Inténtalo nuevamente.",
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
          <IconFileText className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-rose-900">
            Devolver con causal
          </h2>
          <p className="mt-1 text-xs leading-5 text-rose-800/80">
            El caso vuelve al Frontoffice, el SLA se pausa y se notifica al asesor.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {state?.error ? (
          <p role="alert" className="rounded-lg bg-rose-100 px-3 py-2 text-xs text-rose-800">
            {state.error}
          </p>
        ) : null}
        {state?.ok && state.message ? (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs text-emerald-800">
            <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {state.message}
          </p>
        ) : null}

        {bloqueadoPor ? (
          <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-xs leading-5 text-amber-800">
            Bloqueado por {bloqueadoPor}. Libera o reasigna el caso antes de devolverlo.
          </p>
        ) : null}

        <div>
          <label htmlFor="causal" className="field-label text-rose-900">
            Causal de devolución
          </label>
          <select id="causal" name="causal" required defaultValue="" className="field-select">
            <option value="" disabled>
              Selecciona una causal
            </option>
            {CAUSALES_DEVOLUCION.map((causal) => (
              <option key={causal} value={causal}>
                {causal}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="observacion" className="field-label text-rose-900">
            Observación obligatoria
          </label>
          <textarea
            id="observacion"
            name="observacion"
            required
            rows={3}
            maxLength={2000}
            placeholder="Explica qué debe corregir el Frontoffice para subsanar el caso."
            className="field-input min-h-[88px] resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || Boolean(bloqueadoPor)}
          className={cn("btn-primary w-full bg-rose-600 hover:bg-rose-700")}
        >
          {isPending ? "Devolviendo…" : "Devolver al Frontoffice"}
        </button>
      </form>
    </div>
  );
}
