"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { CopyButton } from "@/components/copy-button";
import { EvidenceUploader } from "@/components/evidence-uploader";
import { guardarEvidencias } from "@/app/backoffice/actions";
import {
  buscarDuplicados,
  crearCaso,
  obtenerDetalleDuplicado,
} from "@/app/escalamiento/actions";
import { subirEvidencia } from "@/lib/evidencias";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconFileText,
  IconSearch,
  IconShield,
  IconTicket,
  IconX,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import {
  CATEGORIAS,
  PLANTILLAS,
  generarTextoPlantilla,
  type CampoPlantilla,
  type DatosPlantilla,
} from "@/lib/plantillas";
import type {
  CasoDuplicado,
  ConsultaRadicado,
  CrearCasoState,
  EstadoCaso,
  Evidencia,
} from "@/lib/types";
import { etiquetaEstado } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

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

function esCampoIdentificador(campo: CampoPlantilla): boolean {
  return /cuenta|min|cedula|documento|identificacion/i.test(
    `${campo.name} ${campo.label}`,
  );
}

function tieneLongitudSuficiente(valor: string): boolean {
  const limpio = valor.replace(/[^0-9A-Za-z]/g, "");
  return limpio.length >= 4;
}

export function EscalamientoForm() {
  const [tipologia, setTipologia] = useState(tipologiaInicial);
  const [state, setState] = useState<CrearCasoState>(initialState);
  const [preview, setPreview] = useState(() =>
    generarTextoPlantilla(tipologiaInicial, {}),
  );
  const [isPending, startTransition] = useTransition();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [evidenciaError, setEvidenciaError] = useState<string | null>(null);
  const [duplicados, setDuplicados] = useState<Record<string, CasoDuplicado[]>>({});
  const [confirmados, setConfirmados] = useState<Record<string, boolean>>({});
  const [verificando, setVerificando] = useState<Record<string, boolean>>({});
  const [detalleDuplicado, setDetalleDuplicado] =
    useState<ConsultaRadicado | null>(null);
  const [campoDuplicado, setCampoDuplicado] = useState<string | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const temporizadores = useRef<Record<string, number>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const radicadoExitoso = state.ok ? state.radicado : undefined;

  const plantilla = PLANTILLAS.find((item) => item.nombre === tipologia);

  function refrescarPreview(form: HTMLFormElement, tipologiaActual: string) {
    setPreview(
      generarTextoPlantilla(
        tipologiaActual,
        datosDesdeFormulario(form, tipologiaActual),
      ),
    );
  }

  function cerrarExito() {
    formRef.current?.reset();
    setState(initialState);
    setPreview(generarTextoPlantilla(tipologia, {}));
    setArchivos([]);
    setEvidenciaError(null);
  }

  useEffect(() => {
    if (!radicadoExitoso) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [radicadoExitoso]);

  useEffect(() => {
    const timers = temporizadores.current;
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  async function verificarCampo(nombre: string, valor: string) {
    if (!tieneLongitudSuficiente(valor)) {
      setDuplicados((actual) => ({ ...actual, [nombre]: [] }));
      setConfirmados((actual) => ({ ...actual, [nombre]: false }));
      return;
    }

    setVerificando((actual) => ({ ...actual, [nombre]: true }));
    try {
      const resultados = await buscarDuplicados(valor.trim());
      setDuplicados((actual) => ({ ...actual, [nombre]: resultados }));
      setConfirmados((actual) => ({ ...actual, [nombre]: false }));
    } catch {
      setDuplicados((actual) => ({ ...actual, [nombre]: [] }));
    } finally {
      setVerificando((actual) => ({ ...actual, [nombre]: false }));
    }
  }

  function programarVerificacion(nombre: string, valor: string) {
    if (temporizadores.current[nombre]) {
      window.clearTimeout(temporizadores.current[nombre]);
    }
    temporizadores.current[nombre] = window.setTimeout(() => {
      void verificarCampo(nombre, valor);
    }, 500);
  }

  async function abrirDetalle(campo: string, radicado: string) {
    setCampoDuplicado(campo);
    setCargandoDetalle(true);
    try {
      setDetalleDuplicado(await obtenerDetalleDuplicado(radicado));
    } catch {
      setDetalleDuplicado(null);
    } finally {
      setCargandoDetalle(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pendienteConfirmar = Object.entries(duplicados).some(
      ([campo, resultados]) => resultados.length > 0 && !confirmados[campo],
    );
    if (pendienteConfirmar) {
      setState({
        ok: false,
        error:
          "Existe un caso activo similar. Confirma que se trata de un motivo o tipificación distinto para continuar.",
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    setState(initialState);
    setEvidenciaError(null);

    startTransition(async () => {
      try {
        const result = await crearCaso(formData);
        if (result.ok && result.radicado && archivos.length > 0) {
          try {
            const evidencias: Evidencia[] = [];
            for (const archivo of archivos) {
              evidencias.push(await subirEvidencia(result.radicado, archivo));
            }
            const guardado = await guardarEvidencias(result.radicado, evidencias);
            if (!guardado.ok) {
              setEvidenciaError(
                guardado.error ?? "No fue posible registrar las evidencias del caso.",
              );
            }
          } catch (err) {
            setEvidenciaError(
              err instanceof Error
                ? err.message
                : "No fue posible adjuntar las evidencias. El caso sí fue radicado.",
            );
          }
        }
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

  return (
    <>
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
        ref={formRef}
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
              setDuplicados({});
              setConfirmados({});
              setDetalleDuplicado(null);
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
            const identificador = esCampoIdentificador(campo);
            const coincidencias = duplicados[campo.name] ?? [];

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
                    onBlur={
                      identificador
                        ? (event) => {
                            void verificarCampo(campo.name, event.currentTarget.value);
                          }
                        : undefined
                    }
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
                    onBlur={
                      identificador
                        ? (event) => {
                            void verificarCampo(campo.name, event.currentTarget.value);
                          }
                        : undefined
                    }
                    onChange={
                      identificador
                        ? (event) => {
                            programarVerificacion(campo.name, event.currentTarget.value);
                          }
                        : undefined
                    }
                  />
                )}

                {error ? (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {error}
                  </p>
                ) : campo.help ? (
                  <p className="mt-1.5 text-xs text-slate-400">{campo.help}</p>
                ) : null}

                {verificando[campo.name] ? (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Verificando casos activos...
                  </p>
                ) : null}

                {coincidencias.length > 0 ? (
                  <div
                    role="alert"
                    className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
                  >
                    <p className="flex items-start gap-2 text-xs font-medium leading-5 text-amber-900">
                      <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        Ya existe un caso activo (#{coincidencias[0].numero_radicado}) para este
                        cliente/cuenta en estado {etiquetaEstado(coincidencias[0].estado)},
                        creado el {formatDateTime(coincidencias[0].created_at)} por{" "}
                        {coincidencias[0].creado_por}.
                      </span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 pl-6">
                      <button
                        type="button"
                        onClick={() => {
                          void abrirDetalle(campo.name, coincidencias[0].numero_radicado);
                        }}
                        className="text-[11px] font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
                      >
                        Ver estado del caso actual
                      </button>
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-amber-900">
                        <input
                          type="checkbox"
                          checked={Boolean(confirmados[campo.name])}
                          onChange={(event) => {
                            setConfirmados((actual) => ({
                              ...actual,
                              [campo.name]: event.target.checked,
                            }));
                          }}
                          className="h-3.5 w-3.5 accent-amber-600"
                        />
                        Es un motivo/tipificación distinto
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-7">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Evidencias del caso (opcional)
          </h3>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            Puedes adjuntar capturas antes de radicar; se subirán al bucket por radicado
            una vez creado el caso.
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <EvidenceUploader onArchivosChange={setArchivos} disabled={isPending} />
          </div>
          {evidenciaError ? (
            <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
              {evidenciaError}
            </p>
          ) : null}
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

      {detalleDuplicado || cargandoDetalle ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicado-title"
            className="animate-fade-up max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-amber-200 bg-white shadow-soft sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-amber-100 bg-amber-50 px-5 py-4">
              <div className="flex items-start gap-2.5">
                <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h2 id="duplicado-title" className="text-sm font-semibold text-amber-900">
                    Caso activo del cliente
                  </h2>
                  <p className="mt-0.5 text-xs text-amber-800/80">
                    Revisa el avance antes de radicar un escalamiento duplicado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetalleDuplicado(null);
                  setCampoDuplicado(null);
                }}
                aria-label="Cerrar detalle del caso"
                className="rounded-lg p-1 text-amber-700 transition hover:bg-amber-100"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5">
              {cargandoDetalle ? (
                <p className="text-xs text-slate-500">Cargando detalle del radicado...</p>
              ) : detalleDuplicado ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-brand-700">
                      {detalleDuplicado.caso.numero_radicado}
                    </span>
                    <StatusBadge
                      estado={detalleDuplicado.caso.estado as EstadoCaso}
                      size="sm"
                      mostrarEtiquetaOperativa
                    />
                  </div>

                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Tipificación
                      </dt>
                      <dd className="mt-1 text-xs font-medium text-slate-700">
                        {detalleDuplicado.caso.tipologia}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Radicado por
                      </dt>
                      <dd className="mt-1 text-xs font-medium text-slate-700">
                        {detalleDuplicado.caso.creado_por}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Creado
                      </dt>
                      <dd className="mt-1 text-xs font-medium text-slate-700">
                        {formatDateTime(detalleDuplicado.caso.created_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Paso actual
                      </dt>
                      <dd className="mt-1 text-xs font-medium text-slate-700">
                        {detalleDuplicado.caso.paso_actual}
                      </dd>
                    </div>
                  </dl>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Últimos movimientos
                    </p>
                    <ul className="mt-2 space-y-2">
                      {detalleDuplicado.historial.slice(-4).reverse().map((item) => (
                        <li key={item.id} className="text-[11px] leading-4 text-slate-600">
                          <span className="font-semibold text-slate-800">
                            {etiquetaEstado(item.estado_nuevo)}
                          </span>{" "}
                          · {item.paso_registrado ?? item.accion ?? "Movimiento registrado"}
                          {item.comentario ? ` · ${item.comentario}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No fue posible cargar el detalle del radicado.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setDetalleDuplicado(null);
                  setCampoDuplicado(null);
                }}
                className="btn-secondary"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={!detalleDuplicado || !campoDuplicado}
                onClick={() => {
                  if (campoDuplicado) {
                    setConfirmados((actual) => ({ ...actual, [campoDuplicado]: true }));
                  }
                  setDetalleDuplicado(null);
                  setCampoDuplicado(null);
                }}
                className="btn-primary"
              >
                Continuar con nuevo caso
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {radicadoExitoso ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exito-title"
            aria-describedby="exito-mensaje"
            className="animate-fade-up w-full max-w-md overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-soft sm:rounded-2xl"
          >
            <div className="relative overflow-hidden bg-slate-950 px-6 py-7 text-white">
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.28),transparent_45%),radial-gradient(circle_at_90%_90%,rgba(99,102,241,0.3),transparent_45%)]"
              />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/[0.15] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200 ring-1 ring-inset ring-emerald-300/20">
                  <IconCheck className="h-3.5 w-3.5" />
                  Radicado exitoso
                </span>
                <h2
                  id="exito-title"
                  className="mt-4 text-xl font-semibold tracking-tight"
                >
                  Escalamiento radicado
                </h2>
                <p
                  id="exito-mensaje"
                  className="mt-2 text-sm leading-6 text-slate-300"
                >
                  Tu solicitud ha sido escalada al Backoffice. El tiempo
                  estimado de respuesta es de 24 a 72 horas hábiles.
                </p>

                <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Número de radicado
                    </p>
                    <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-white">
                      {radicadoExitoso}
                    </p>
                  </div>
                  <CopyButton
                    value={radicadoExitoso}
                    label="Copiar radicado"
                    copiedLabel="Radicado copiado"
                    tone="dark"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800">
                  Tiempo estimado de respuesta
                </p>
                <p className="mt-1 text-sm font-semibold text-amber-900">
                  24 a 72 horas hábiles
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800/90">
                  Tu caso quedó registrado con un límite máximo de 72 horas
                  desde su radicación. Podrás ver la cuenta regresiva en la
                  consulta del radicado.
                </p>
                {state.slaDeadline ? (
                  <p className="mt-2 flex items-center gap-1.5 border-t border-amber-200/70 pt-2 text-[11px] font-medium text-amber-800">
                    <IconClock className="h-3.5 w-3.5" />
                    Límite: {formatDateTime(state.slaDeadline)}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Link
                  href={`/consulta?radicado=${encodeURIComponent(radicadoExitoso)}`}
                  className="btn-secondary"
                >
                  <IconSearch className="h-4 w-4 text-slate-500" />
                  Consultar trazabilidad
                </Link>
                <button
                  type="button"
                  onClick={cerrarExito}
                  autoFocus
                  className="btn-primary"
                >
                  Entendido
                  <IconCheck className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
