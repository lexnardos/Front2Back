"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { EvidenceUploader } from "@/components/evidence-uploader";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { reenviarCaso } from "@/app/consulta/actions";
import { getPlantilla } from "@/lib/plantillas";
import type { ActualizarCasoState, Evidencia } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReenvioFormProps {
  casoId: string;
  radicado: string;
  tipologia: string;
  datos: Record<string, unknown>;
  evidencias: Evidencia[];
}

export function ReenvioForm({
  casoId,
  radicado,
  tipologia,
  datos,
  evidencias,
}: ReenvioFormProps) {
  const router = useRouter();
  const plantilla = getPlantilla(tipologia);
  const [adjuntos, setAdjuntos] = useState<Evidencia[]>(evidencias);
  const [state, setState] = useState<ActualizarCasoState | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("caso_id", casoId);
    formData.set("radicado", radicado);
    formData.set("tipologia", tipologia);
    formData.set("evidencias", JSON.stringify(adjuntos));
    setState(null);

    startTransition(async () => {
      try {
        const resultado = await reenviarCaso(formData);
        setState(resultado);
        if (resultado.ok) router.refresh();
      } catch {
        setState({
          ok: false,
          error: "No fue posible conectar con el servidor. Inténtalo nuevamente.",
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <h2 className="text-sm font-semibold text-amber-900">
        Corregir y reenviar
      </h2>
      <p className="mt-1 text-xs leading-5 text-amber-800/80">
        Ajusta los datos solicitados por Backoffice, adjunta la evidencia faltante
        y reenvía el caso. El SLA se reanudará al enviar.
      </p>

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

        {plantilla ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {plantilla.campos.map((campo) => {
              const valor = datos[campo.name];
              const inicial = typeof valor === "string" ? valor : "";
              const id = `reenvio_${campo.name}`;
              return (
                <div key={campo.name} className={cn(campo.type === "textarea" && "sm:col-span-2")}>
                  <label htmlFor={id} className="field-label">
                    {campo.label}
                  </label>
                  {campo.type === "textarea" ? (
                    <textarea
                      id={id}
                      name={`campo_${campo.name}`}
                      defaultValue={inicial}
                      rows={3}
                      maxLength={campo.maxLength ?? 1500}
                      className="field-input min-h-[80px] resize-y"
                    />
                  ) : campo.type === "select" ? (
                    <select
                      id={id}
                      name={`campo_${campo.name}`}
                      defaultValue={inicial}
                      className="field-select"
                    >
                      <option value="">Selecciona una opción</option>
                      {campo.options?.map((opcion) => (
                        <option key={opcion.value} value={opcion.value}>
                          {opcion.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={id}
                      name={`campo_${campo.name}`}
                      type={campo.type}
                      defaultValue={inicial}
                      maxLength={campo.maxLength}
                      className="field-input"
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <EvidenceUploader
            radicado={radicado}
            evidenciasIniciales={evidencias}
            onEvidenciasChange={setAdjuntos}
          />
        </div>

        <div>
          <label htmlFor="comentario_reenvio" className="field-label">
            Observación de la subsanación
          </label>
          <textarea
            id="comentario_reenvio"
            name="comentario"
            rows={3}
            maxLength={2000}
            placeholder="Cuéntale a Backoffice qué corregiste."
            className="field-input min-h-[80px] resize-y"
          />
        </div>

        <button type="submit" disabled={isPending} className="btn-primary w-full">
          {isPending ? "Reenviando…" : "Corregir y reenviar"}
          <IconArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
