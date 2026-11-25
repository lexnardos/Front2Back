"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  liberarCaso,
  reasignarCaso,
  tomarCaso,
} from "@/app/backoffice/actions";
import {
  IconArrowRight,
  IconClock,
  IconLock,
  IconUser,
} from "@/components/icons";
import { SlaCountdown } from "@/components/sla-countdown";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import type { CasoEscalamiento, EstadoCaso } from "@/lib/types";
import { cn, formatDateOnly, truncate } from "@/lib/utils";

interface Analista {
  id: string;
  nombre_completo: string;
}

interface BackofficeBoardProps {
  casosIniciales: CasoEscalamiento[];
  usuarioId: string;
  analistas: Analista[];
}

type AccionLock = (formData: FormData) => Promise<{
  ok: boolean;
  error?: string;
  message?: string;
}>;

export function BackofficeBoard({
  casosIniciales,
  usuarioId,
  analistas,
}: BackofficeBoardProps) {
  const router = useRouter();
  const [casos, setCasos] = useState(casosIniciales);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCasos(casosIniciales);
  }, [casosIniciales]);

  useEffect(() => {
    const supabase = createClient();

    const aplicar = (item: Partial<CasoEscalamiento> & { id: string }) => {
      setCasos((actuales) => {
        const indice = actuales.findIndex((caso) => caso.id === item.id);
        if (indice === -1) {
          return [item as CasoEscalamiento, ...actuales];
        }
        const copia = [...actuales];
        copia[indice] = { ...copia[indice], ...item };
        return copia;
      });
    };

    const canal = supabase
      .channel(`f2b-bandeja-${usuarioId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "casos_escalamiento",
        },
        (payload) => {
          aplicar(payload.new as Partial<CasoEscalamiento> & { id: string });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "casos_escalamiento",
        },
        (payload) => {
          aplicar(payload.new as Partial<CasoEscalamiento> & { id: string });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [usuarioId]);

  function ejecutar(
    casoId: string,
    accion: AccionLock,
    formData: FormData,
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
          if (accion === tomarCaso) {
            router.push(`/backoffice/gestion?estado=en-proceso&caso=${casoId}`);
            return;
          }
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

  function datosCaso(casoId: string) {
    const datos = new FormData();
    datos.set("caso_id", casoId);
    return datos;
  }

  function esFinal(caso: CasoEscalamiento) {
    return caso.estado === "Completado" || caso.estado === "Rechazado";
  }

  function esMio(caso: CasoEscalamiento) {
    const id = caso.assigned_to_id ?? caso.asignado_a;
    return Boolean(id && id === usuarioId);
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

  function acciones(caso: CasoEscalamiento, compacto = false) {
    if (esFinal(caso)) return null;

    const ocupado = estaBloqueado(caso);
    const mio = esMio(caso);
    const deshabilitado = isPending && procesando === caso.id;

    if (!ocupado) {
      return (
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => ejecutar(caso.id, tomarCaso, datosCaso(caso.id))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
        >
          <IconLock className="h-3.5 w-3.5" />
          Tomar caso
        </button>
      );
    }

    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", compacto && "justify-end")}>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
            mio
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700",
          )}
          title={caso.locked_at ? `Bloqueado desde ${formatDateOnly(caso.locked_at)}` : undefined}
        >
          <IconLock className="h-3 w-3" />
          {mio ? "En gestión por ti" : `En gestión por ${nombrePropietario(caso)}`}
        </span>
        <button
          type="button"
          disabled={deshabilitado || !mio}
          onClick={() => ejecutar(caso.id, liberarCaso, datosCaso(caso.id))}
          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Liberar
        </button>
        {!mio ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const datos = new FormData(event.currentTarget);
              ejecutar(caso.id, reasignarCaso, datos);
            }}
            className="flex items-center gap-1"
          >
            <input type="hidden" name="caso_id" value={caso.id} />
            <select
              name="usuario_id"
              required
              defaultValue=""
              aria-label={`Reasignar ${caso.numero_radicado}`}
              className="max-w-[120px] rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-600 outline-none"
            >
              <option value="" disabled>
                Reasignar
              </option>
              {analistas
                .filter((analista) => analista.id !== caso.assigned_to_id)
                .map((analista) => (
                  <option key={analista.id} value={analista.id}>
                    {analista.nombre_completo}
                  </option>
                ))}
            </select>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <>
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

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Radicado</th>
              <th className="px-4 py-3 font-semibold">Tipología</th>
              <th className="px-4 py-3 font-semibold">Creado por</th>
              <th className="px-4 py-3 font-semibold">Asignado</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">SLA</th>
              <th className="px-4 py-3 font-semibold">Paso actual</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {casos.map((caso) => (
              <tr key={caso.id} className="group transition hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-5 py-3.5">
                  <Link
                    href={`/backoffice/${caso.id}`}
                    className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {caso.numero_radicado}
                  </Link>
                </td>
                <td className="max-w-[180px] px-4 py-3.5">
                  <p className="truncate text-xs font-medium text-slate-700">
                    {caso.tipologia}
                  </p>
                </td>
                <td className="max-w-[150px] px-4 py-3.5">
                  <p className="truncate text-xs text-slate-500">{caso.creado_por}</p>
                </td>
                <td className="max-w-[180px] px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <IconUser className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{nombrePropietario(caso)}</span>
                  </span>
                  <div className="mt-1">{acciones(caso)}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <StatusBadge
                    estado={caso.estado as EstadoCaso}
                    size="sm"
                    mostrarEtiquetaOperativa
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <SlaCountdown
                    compact
                    createdAt={caso.created_at}
                    slaDeadline={caso.sla_deadline}
                    primeraRespuestaAt={caso.primera_respuesta_at}
                    estado={caso.estado}
                    updatedAt={caso.updated_at}
                    pausado={caso.estado === "Devuelto" || Boolean(caso.sla_pausado_desde)}
                  />
                </td>
                <td className="max-w-[160px] px-4 py-3.5">
                  <p className="truncate text-xs text-slate-500" title={caso.paso_actual}>
                    {truncate(caso.paso_actual, 32)}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <IconClock className="h-3.5 w-3.5" />
                    {formatDateOnly(caso.created_at)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <Link
                    href={`/backoffice/gestion?estado=en-proceso&caso=${caso.id}`}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 transition group-hover:bg-white group-hover:text-brand-700"
                  >
                    Gestionar
                    <IconArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {casos.map((caso) => (
          <div key={caso.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/backoffice/${caso.id}`}
                  className="font-mono text-xs font-semibold text-brand-700"
                >
                  {caso.numero_radicado}
                </Link>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {caso.tipologia}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusBadge
                  estado={caso.estado as EstadoCaso}
                  size="sm"
                  mostrarEtiquetaOperativa
                />
                <SlaCountdown
                  compact
                  createdAt={caso.created_at}
                  slaDeadline={caso.sla_deadline}
                  primeraRespuestaAt={caso.primera_respuesta_at}
                  estado={caso.estado}
                  updatedAt={caso.updated_at}
                  pausado={caso.estado === "Devuelto" || Boolean(caso.sla_pausado_desde)}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <IconUser className="h-3.5 w-3.5" />
                {caso.creado_por}
              </span>
              <span className="inline-flex items-center gap-1">
                <IconClock className="h-3.5 w-3.5" />
                {formatDateOnly(caso.created_at)}
              </span>
            </div>
            <p className="mt-2 truncate text-xs text-slate-500">
              Paso: {caso.paso_actual}
            </p>
            <div className="mt-3">{acciones(caso, true)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
