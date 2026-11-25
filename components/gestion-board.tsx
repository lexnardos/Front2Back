"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  liberarCaso,
  tomarCaso,
} from "@/app/backoffice/actions";
import { BackofficeActionsPanel } from "@/components/backoffice-actions-panel";
import { DatosPlantilla } from "@/components/datos-plantilla";
import {
  IconArrowRight,
  IconClock,
  IconInbox,
  IconLock,
  IconSearch,
  IconUser,
  IconX,
} from "@/components/icons";
import { SlaCountdown } from "@/components/sla-countdown";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import type { CasoEscalamiento, EstadoCaso } from "@/lib/types";
import {
  cn,
  formatDateOnly,
  normalizarBusqueda,
  truncate,
  valorPlantilla,
} from "@/lib/utils";

type FiltroGestion = "todos" | "Pendiente" | "En Proceso";

interface Analista {
  id: string;
  nombre_completo: string;
}

interface GestionBoardProps {
  casosIniciales: CasoEscalamiento[];
  usuarioId: string;
  nombreAnalista: string;
  analistas: Analista[];
  filtroInicial: FiltroGestion;
  casoEnfocadoId: string | null;
}

type AccionLock = (formData: FormData) => Promise<{
  ok: boolean;
  error?: string;
  message?: string;
}>;

const ESTADOS_GESTION: EstadoCaso[] = ["Pendiente", "En Proceso"];

function urlDe(filtro: FiltroGestion, casoId: string | null): string {
  const params = new URLSearchParams();
  if (filtro !== "todos") {
    params.set("estado", filtro === "Pendiente" ? "pendientes" : "en-proceso");
  }
  if (casoId) params.set("caso", casoId);
  const query = params.toString();
  return query ? `/backoffice/gestion?${query}` : "/backoffice/gestion";
}

export function GestionBoard({
  casosIniciales,
  usuarioId,
  nombreAnalista,
  analistas,
  filtroInicial,
  casoEnfocadoId,
}: GestionBoardProps) {
  const router = useRouter();
  const [casos, setCasos] = useState(casosIniciales);
  const [filtro, setFiltro] = useState<FiltroGestion>(filtroInicial);
  const [casoActivoId, setCasoActivoId] = useState<string | null>(casoEnfocadoId);
  const [busqueda, setBusqueda] = useState("");
  const [procesando, setProcesando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const tarjetasRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setCasos(casosIniciales);
  }, [casosIniciales]);

  useEffect(() => {
    setFiltro(filtroInicial);
  }, [filtroInicial]);

  useEffect(() => {
    if (casoEnfocadoId) setCasoActivoId(casoEnfocadoId);
  }, [casoEnfocadoId]);

  useEffect(() => {
    window.history.replaceState(null, "", urlDe(filtro, casoActivoId));
  }, [filtro, casoActivoId]);

  useEffect(() => {
    const supabase = createClient();

    const aplicar = (item: Partial<CasoEscalamiento> & { id: string }) => {
      setCasos((actuales) => {
        const indice = actuales.findIndex((caso) => caso.id === item.id);
        if (!ESTADOS_GESTION.includes(item.estado as EstadoCaso)) {
          if (indice === -1) return actuales;
          const copia = [...actuales];
          copia.splice(indice, 1);
          return copia;
        }
        if (indice === -1) return [item as CasoEscalamiento, ...actuales];
        const copia = [...actuales];
        copia[indice] = { ...copia[indice], ...item };
        return copia;
      });
    };

    const canal = supabase
      .channel(`f2b-gestion-${usuarioId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "casos_escalamiento" },
        (payload) => aplicar(payload.new as Partial<CasoEscalamiento> & { id: string }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "casos_escalamiento" },
        (payload) => aplicar(payload.new as Partial<CasoEscalamiento> & { id: string }),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "casos_escalamiento" },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setCasos((actuales) => actuales.filter((caso) => caso.id !== id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [usuarioId]);

  useEffect(() => {
    if (!casoActivoId) return;
    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setCasoActivoId(null);
    };
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", manejarTecla);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", manejarTecla);
    };
  }, [casoActivoId]);

  const pendientes = casos.filter((caso) => caso.estado === "Pendiente").length;
  const enProceso = casos.filter((caso) => caso.estado === "En Proceso").length;
  const total = pendientes + enProceso;

  const visibles = useMemo(() => {
    const termino = normalizarBusqueda(busqueda);
    const peso = (caso: CasoEscalamiento) => {
      if (caso.estado === "Pendiente") return 0;
      return (caso.assigned_to_id ?? caso.asignado_a) === usuarioId ? 1 : 2;
    };

    return casos
      .filter((caso) => filtro === "todos" || caso.estado === filtro)
      .filter((caso) => {
        if (!termino) return true;
        const campos = [
          caso.numero_radicado,
          caso.tipologia,
          caso.creado_por,
          caso.paso_actual,
          valorPlantilla(caso.datos_plantilla, "cuenta_min", "cuenta", "numero_cuenta"),
          valorPlantilla(caso.datos_plantilla, "cedula", "cedula_cliente"),
          valorPlantilla(caso.datos_plantilla, "cliente", "nombre_cliente"),
        ];
        return campos.some((campo) => normalizarBusqueda(campo).includes(termino));
      })
      .sort(
        (a, b) =>
          peso(a) - peso(b) || Date.parse(b.created_at) - Date.parse(a.created_at),
      );
  }, [casos, filtro, busqueda, usuarioId]);

  useEffect(() => {
    if (!casoActivoId) return;
    tarjetasRef.current[casoActivoId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [casoActivoId, visibles]);

  const casoActivo = casos.find((caso) => caso.id === casoActivoId) ?? null;

  function esMio(caso: CasoEscalamiento) {
    return (caso.assigned_to_id ?? caso.asignado_a) === usuarioId;
  }

  function estaBloqueado(caso: CasoEscalamiento) {
    return Boolean(caso.locked_at || caso.assigned_to_id);
  }

  function nombrePropietario(caso: CasoEscalamiento) {
    return (
      caso.assigned_to_name ??
      caso.asignado?.nombre_completo ??
      "otro analista"
    );
  }

  function datosCaso(casoId: string) {
    const datos = new FormData();
    datos.set("caso_id", casoId);
    return datos;
  }

  function marcarTomado(casoId: string) {
    const ahora = new Date().toISOString();
    setCasos((actuales) =>
      actuales.map((caso) =>
        caso.id === casoId
          ? {
              ...caso,
              estado: "En Proceso" as EstadoCaso,
              paso_actual: "En Gestión",
              locked_at: ahora,
              asignado_a: usuarioId,
              assigned_to_id: usuarioId,
              assigned_to_name: nombreAnalista || "Tú",
            }
          : caso,
      ),
    );
  }

  function marcarLiberado(casoId: string) {
    setCasos((actuales) =>
      actuales.map((caso) =>
        caso.id === casoId
          ? {
              ...caso,
              estado: "Pendiente" as EstadoCaso,
              paso_actual: "Disponible en bandeja",
              locked_at: null,
              asignado_a: null,
              assigned_to_id: null,
              assigned_to_name: null,
            }
          : caso,
      ),
    );
  }

  function ejecutar(
    casoId: string,
    accion: AccionLock,
    formData: FormData,
    despues?: () => void,
  ) {
    setProcesando(casoId);
    setMensaje(null);
    startTransition(async () => {
      try {
        const resultado = await accion(formData);
        setMensaje({
          ok: resultado.ok,
          texto: resultado.ok
            ? resultado.message ?? "Operación realizada."
            : resultado.error ?? "No fue posible completar la operación.",
        });
        if (resultado.ok) {
          despues?.();
          router.refresh();
        }
      } catch {
        setMensaje({
          ok: false,
          texto: "No fue posible conectar con el servidor. Inténtalo nuevamente.",
        });
      } finally {
        setProcesando(null);
      }
    });
  }

  const pestañas: Array<{
    value: FiltroGestion;
    label: string;
    cantidad: number;
  }> = [
    { value: "todos", label: "Total en gestión", cantidad: total },
    { value: "Pendiente", label: "Pendientes", cantidad: pendientes },
    { value: "En Proceso", label: "En Proceso", cantidad: enProceso },
  ];

  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtros de gestión">
              {pestañas.map((pestaña) => (
                <button
                  key={pestaña.value}
                  type="button"
                  role="tab"
                  aria-selected={filtro === pestaña.value}
                  onClick={() => setFiltro(pestaña.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition",
                    filtro === pestaña.value
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {pestaña.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      filtro === pestaña.value
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {pestaña.cantidad}
                  </span>
                </button>
              ))}
            </div>
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Buscar en gestión</span>
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Radicado, cliente, cuenta o cédula"
                className="field-input mt-0 pl-9 text-xs"
              />
            </label>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Actualización automática con Supabase Realtime
          </p>
        </div>

        {mensaje ? (
          <div
            role={mensaje.ok ? "status" : "alert"}
            className={cn(
              "border-b px-4 py-2.5 text-xs font-medium sm:px-5",
              mensaje.ok
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : "border-rose-100 bg-rose-50 text-rose-800",
            )}
          >
            {mensaje.texto}
          </div>
        ) : null}

        {visibles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <IconInbox className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {busqueda
                  ? "Sin resultados para esta búsqueda"
                  : filtro === "Pendiente"
                    ? "No hay casos pendientes"
                    : filtro === "En Proceso"
                      ? "No hay casos en gestión"
                      : "No hay casos activos"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {busqueda
                  ? "Prueba con otro radicado, cliente o número de cuenta."
                  : "Los cambios de estado aparecen aquí automáticamente."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibles.map((caso) => {
              const mio = esMio(caso);
              const ocupado = estaBloqueado(caso);
              const deshabilitado = isPending && procesando === caso.id;
              const resaltado = caso.id === casoActivoId;
              const campos = [
                {
                  etiqueta: "Cuenta / MIN",
                  valor: valorPlantilla(
                    caso.datos_plantilla,
                    "cuenta_min",
                    "cuenta",
                    "numero_cuenta",
                  ),
                },
                {
                  etiqueta: "Cédula",
                  valor: valorPlantilla(
                    caso.datos_plantilla,
                    "cedula",
                    "cedula_cliente",
                  ),
                },
                {
                  etiqueta: "Cliente",
                  valor: valorPlantilla(
                    caso.datos_plantilla,
                    "cliente",
                    "nombre_cliente",
                  ),
                },
              ].filter((campo) => Boolean(campo.valor));

              return (
                <div
                  key={caso.id}
                  ref={(nodo) => {
                    tarjetasRef.current[caso.id] = nodo;
                  }}
                  className={cn(
                    "px-4 py-4 transition sm:px-5",
                    resaltado ? "bg-brand-50/60" : "hover:bg-slate-50/60",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-xl border bg-white p-4 sm:p-5",
                      resaltado
                        ? "border-brand-300 ring-2 ring-brand-200"
                        : mio
                          ? "border-sky-200"
                          : "border-slate-200",
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCasoActivoId(caso.id)}
                            className="font-mono text-sm font-semibold text-brand-700 transition hover:text-brand-900 hover:underline"
                          >
                            {caso.numero_radicado}
                          </button>
                          <StatusBadge
                            estado={caso.estado as EstadoCaso}
                            size="sm"
                            mostrarEtiquetaOperativa
                          />
                          {caso.estado === "En Proceso" ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                mio
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700",
                              )}
                            >
                              <IconLock className="h-3 w-3" />
                              {mio ? "Tomado por ti" : truncate(nombrePropietario(caso), 24)}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-2 text-sm font-semibold text-slate-900">
                          {caso.tipologia}
                        </h3>

                        {campos.length > 0 ? (
                          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                            {campos.map((campo) => (
                              <span
                                key={campo.etiqueta}
                                className="text-[11px] text-slate-600"
                                title={campo.valor}
                              >
                                <span className="font-semibold uppercase tracking-wide text-slate-400">
                                  {campo.etiqueta}:{" "}
                                </span>
                                {truncate(campo.valor, 28)}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <IconUser className="h-3.5 w-3.5" />
                            {caso.creado_por}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <IconClock className="h-3.5 w-3.5" />
                            {formatDateOnly(caso.created_at)}
                          </span>
                          <span title={caso.paso_actual}>
                            Paso: {truncate(caso.paso_actual, 34)}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                        <SlaCountdown
                          compact
                          createdAt={caso.created_at}
                          slaDeadline={caso.sla_deadline}
                          primeraRespuestaAt={caso.primera_respuesta_at}
                          estado={caso.estado}
                          updatedAt={caso.updated_at}
                          pausado={Boolean(caso.sla_pausado_desde)}
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          {!ocupado ? (
                            <button
                              type="button"
                              disabled={deshabilitado}
                              onClick={() =>
                                ejecutar(
                                  caso.id,
                                  tomarCaso,
                                  datosCaso(caso.id),
                                  () => {
                                    marcarTomado(caso.id);
                                    setFiltro("En Proceso");
                                    setCasoActivoId(caso.id);
                                  },
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                            >
                              <IconLock className="h-3.5 w-3.5" />
                              Tomar y gestionar
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setCasoActivoId(caso.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                              >
                                Abrir gestión
                                <IconArrowRight className="h-3.5 w-3.5" />
                              </button>
                              {mio ? (
                                <button
                                  type="button"
                                  disabled={deshabilitado}
                                  onClick={() =>
                                    ejecutar(
                                      caso.id,
                                      liberarCaso,
                                      datosCaso(caso.id),
                                      () => marcarLiberado(caso.id),
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Liberar
                                </button>
                              ) : null}
                            </>
                          )}
                          <Link
                            href={`/backoffice/${caso.id}`}
                            className="text-[11px] font-semibold text-slate-500 transition hover:text-brand-700"
                          >
                            Ficha completa
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {casoActivo ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setCasoActivoId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-gestion"
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    id="titulo-gestion"
                    className="font-mono text-sm font-semibold text-brand-700 sm:text-base"
                  >
                    {casoActivo.numero_radicado}
                  </p>
                  <StatusBadge
                    estado={casoActivo.estado as EstadoCaso}
                    size="sm"
                    mostrarEtiquetaOperativa
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{casoActivo.tipologia}</p>
              </div>
              <button
                type="button"
                onClick={() => setCasoActivoId(null)}
                aria-label="Cerrar gestión"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-5 sm:px-6">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px]">
                <div className="space-y-4">
                  <SlaCountdown
                    createdAt={casoActivo.created_at}
                    slaDeadline={casoActivo.sla_deadline}
                    primeraRespuestaAt={casoActivo.primera_respuesta_at}
                    estado={casoActivo.estado}
                    updatedAt={casoActivo.updated_at}
                    pausado={Boolean(casoActivo.sla_pausado_desde)}
                  />
                  <div className="card overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <h2 className="text-sm font-semibold text-slate-900">
                        Datos de la solicitud
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Información registrada desde el Frontoffice.
                      </p>
                    </div>
                    <div className="px-5 py-4">
                      <DatosPlantilla
                        tipologia={casoActivo.tipologia}
                        datos={casoActivo.datos_plantilla}
                      />
                    </div>
                  </div>
                  <Link
                    href={`/backoffice/${casoActivo.id}`}
                    className="btn-secondary w-full sm:w-auto"
                  >
                    Ver ficha, evidencias y auditoría
                    <IconArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </div>

                <BackofficeActionsPanel
                  casoInicial={casoActivo}
                  usuarioId={usuarioId}
                  analistas={analistas}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
