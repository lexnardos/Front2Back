"use client";

import Link from "next/link";
import {
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { CopyButton } from "@/components/copy-button";
import {
  IconArrowRight,
  IconCheck,
  IconFileText,
  IconSearch,
  IconShield,
  IconTicket,
} from "@/components/icons";
import {
  CATEGORIAS,
  PLANTILLAS,
  generarTextoPlantilla,
  type DatosPlantilla,
} from "@/lib/plantillas";
import type { CrearCasoState } from "@/lib/types";
import { crearCaso } from "@/app/escalamiento/actions";
import { cn } from "@/lib/utils";

const initialState: CrearCasoState = { ok: false };
const tipologiaInicial = PLANTILLAS[0]?.nombre ?? "";

function datosDesdeFormulario(
  form: HTMLFormElement,
  tipologiaActual: string,
): DatosPlantilla {
  const formData = new FormData(form);
  const plantilla = PLANTILLAS.find((item) => item.nombre === tipologiaActual);
  const datos: DatosPlantilla = {};

  plantilla?.campos.forEach((campo) => {
    const value = formData.get(`campo_${campo.name}`);
    if (typeof value === "string" && value.trim()) {
      datos[campo.name] = value.trim();
    }
  });

  return datos;
}

export function EscalamientoForm() {
  const [tipologia, setTipologia] = useState(tipologiaInicial);
  const [state, setState] = useState<CrearCasoState>(initialState);
  const [preview, setPreview] = useState(() =>
    generarTextoPlantilla(tipologiaInicial, {}),
  );
  const [isPending, startTransition] = useTransition();

  const plantilla = PLANTILLAS.find((item) => item.nombre === tipologia);

  function refrescarPreview(form: HTMLFormElement, tipologiaActual: string) {
    setPreview(
      generarTextoPlantilla(
        tipologiaActual,
        datosDesdeFormulario(form, tipologiaActual),
      ),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setState(initialState);

    startTransition(async () => {
      try {
        const result = await crearCaso(formData);
        setState(result);
      } catch {
        setState({
          ok: false,
          error:
            "No fue posible conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.",
        });
      }
    });
  }

  if (state.ok && state.radicado) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="relative overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-8">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.28),transparent_40%),radial-gradient(circle_at_90%_90%,rgba(99,102,241,0.3),transparent_40%)]"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/[0.15] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200 ring-1 ring-inset ring-emerald-300/20">
              <IconCheck className="h-3.5 w-3.5" />
              Escalamiento radicado
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              Radicado creado correctamente
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">
              Comparte este número con el cliente o consérvalo para hacer
              seguimiento. El caso ya está en la bandeja de Backoffice.
            </p>

            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Número de radicado
                </p>
                <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  {state.radicado}
                </p>
              </div>
              <CopyButton
                value={state.radicado}
                label="Copiar radicado"
                copiedLabel="Radicado copiado"
                tone="dark"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/consulta?radicado=${encodeURIComponent(state.radicado)}`}
              className="btn-secondary"
            >
              <IconSearch className="h-4 w-4 text-slate-500" />
              Consultar trazabilidad
            </Link>
            <button
              type="button"
              onClick={() => setState(initialState)}
              className="btn-primary"
            >
              Crear otro escalamiento
              <IconArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Estado inicial: <span className="font-semibold">Pendiente</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <IconTicket className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Datos del escalamiento
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Selecciona la tipología y completa los campos de la plantilla.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        onInput={(event) => refrescarPreview(event.currentTarget, tipologia)}
        className="px-5 py-5 sm:px-6 sm:py-6"
      >
        {state.error ? (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
          >
            {state.error}
          </div>
        ) : null}

        <div>
          <label htmlFor="tipologia" className="field-label">
            Tipología del escalamiento
          </label>
          <select
            id="tipologia"
            name="tipologia"
            required
            value={tipologia}
            onChange={(event) => {
              const nuevaTipologia = event.target.value;
              setTipologia(nuevaTipologia);
              setState(initialState);
              setPreview(generarTextoPlantilla(nuevaTipologia, {}));
            }}
            className="field-select"
          >
            {CATEGORIAS.map((categoria) => (
              <optgroup key={categoria} label={categoria}>
                {PLANTILLAS.filter(
                  (item) => item.categoria === categoria,
                ).map((item) => (
                  <option key={item.nombre} value={item.nombre}>
                    {item.nombre}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {state.fieldErrors?.tipologia ? (
            <p className="mt-1.5 text-xs font-medium text-rose-600">
              {state.fieldErrors.tipologia}
            </p>
          ) : null}
        </div>

        {plantilla ? (
          <div className="mt-4 space-y-3">
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
              {plantilla.categoria}
            </span>
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3">
              <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs leading-5 text-amber-900">
                {plantilla.descripcion}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-x-5 gap-y-5 sm:grid-cols-2">
          {plantilla?.campos.map((campo) => {
            const fieldId = `campo_${campo.name}`;
            const error = state.fieldErrors?.[campo.name];

            return (
              <div
                key={campo.name}
                className={cn(campo.type === "textarea" && "sm:col-span-2")}
              >
                <label htmlFor={fieldId} className="field-label">
                  {campo.label}
                  {campo.required ? (
                    <span className="ml-1 text-rose-500" aria-hidden>
                      *
                    </span>
                  ) : campo.required === false ? (
                    <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
                      (opcional)
                    </span>
                  ) : null}
                </label>

                {campo.type === "textarea" ? (
                  <textarea
                    id={fieldId}
                    name={fieldId}
                    required={campo.required}
                    maxLength={campo.maxLength}
                    placeholder={campo.placeholder}
                    rows={4}
                    className="field-input min-h-[112px] resize-y"
                  />
                ) : campo.type === "select" ? (
                  <select
                    id={fieldId}
                    name={fieldId}
                    required={campo.required}
                    defaultValue=""
                    className="field-select"
                  >
                    <option value="" disabled>
                      Selecciona una opción
                    </option>
                    {campo.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={fieldId}
                    name={fieldId}
                    type={campo.type}
                    required={campo.required}
                    maxLength={campo.maxLength}
                    placeholder={campo.placeholder}
                    step={campo.step}
                    min={campo.type === "number" ? "0" : undefined}
                    inputMode={campo.type === "number" ? "decimal" : undefined}
                    className="field-input"
                  />
                )}

                {error ? (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {error}
                  </p>
                ) : campo.help ? (
                  <p className="mt-1.5 text-xs text-slate-400">{campo.help}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {plantilla ? (
          <div className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <IconFileText className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Formato generado
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Se actualiza en tiempo real mientras escribes.
                  </p>
                </div>
              </div>
              <CopyButton
                value={preview}
                label="Copiar formato"
                copiedLabel="Formato copiado"
              />
            </div>
            <textarea
              readOnly
              value={preview}
              rows={7}
              aria-label="Vista previa del formato de la plantilla"
              className="w-full resize-y bg-transparent px-4 py-3 font-mono text-[11px] leading-5 text-slate-600 outline-none"
            />
          </div>
        ) : null}

        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-400">
            Al radicar, el caso queda en estado{" "}
            <span className="font-semibold text-slate-600">Pendiente</span>.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary w-full sm:w-auto"
          >
            {isPending ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                Radicando...
              </>
            ) : (
              <>
                Radicar escalamiento
                <IconArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
