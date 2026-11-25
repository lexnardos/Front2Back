"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  liberarCaso,
  reasignarCaso,
  tomarCaso,
} from "@/app/backoffice/actions";
import { BackofficeUpdateForm } from "@/components/backoffice-update-form";
import { DevolucionForm } from "@/components/devolucion-form";
import { IconLock, IconUserCog } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import type { CasoEscalamiento, EstadoCaso } from "@/lib/types";

interface Analista {
  id: string;
  nombre_completo: string;
}

interface BackofficeActionsPanelProps {
  casoInicial: CasoEscalamiento;
  usuarioId: string;
  analistas: Analista[];
}

type AccionLock = (formData: FormData) => Promise<{
  ok: boolean;
  error?: string;
  message?: string;
}>;

export function BackofficeActionsPanel({
  casoInicial,
  usuarioId,
  analistas,
}: BackofficeActionsPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [caso, setCaso] = useState(casoInicial);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCaso(casoInicial);
  }, [casoInicial]);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`f2b-caso-lock-${casoInicial.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "casos_escalamiento",
          filter: `id=eq.${casoInicial.id}`,
        },
        (payload) => {
          setCaso((actual) => ({ ...actual, ...(payload.new as Partial<CasoEscalamiento>) }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [casoInicial.id]);

  const ocupado = Boolean(caso.locked_at || caso.assigned_to_id);
  const esMio = (caso.assigned_to_id ?? caso.asignado_a) === usuarioId;
  const propietario =
    caso.assigned_to_name ?? caso.asignado?.nombre_completo ?? "otro analista";
  const esFinal = caso.estado === "Completado" || caso.estado === "Rechazado";
  const bloqueadoPorOtro = ocupado && !esMio ? propietario : null;

  function ejecutar(accion: AccionLock, formData: FormData) {
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
        if (!resultado.ok) return;

        if (accion === tomarCaso && !pathname.startsWith("/backoffice/gestion")) {
          router.push(`/backoffice/gestion?estado=en-proceso&caso=${caso.id}`);
          return;
        }
        router.refresh();
      } catch {
        setMensaje({
          ok: false,
          texto: "No fue posible conectar con el servidor. Inténtalo nuevamente.",
        });
      }
    });
  }

  function datosBase() {
    const datos = new FormData();
    datos.set("caso_id", caso.id);
    return datos;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <IconUserCog className="h-4 w-4 text-slate-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Control de gestión
          </h2>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!ocupado ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              Sin asignar · disponible para tomar
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                esMio
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              <IconLock className="h-3 w-3" />
              {esMio ? "En gestión por ti" : `En gestión por ${propietario}`}
            </span>
          )}
        </div>

        {mensaje ? (
          <p
            role={mensaje.ok ? "status" : "alert"}
            className={`mt-3 rounded-lg px-3 py-2 text-[11px] font-medium ${
              mensaje.ok
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800"
            }`}
          >
            {mensaje.texto}
          </p>
        ) : null}

        {!esFinal ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!ocupado ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => ejecutar(tomarCaso, datosBase())}
                className="rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Tomar caso
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isPending || !esMio}
                  onClick={() => ejecutar(liberarCaso, datosBase())}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Liberar caso
                </button>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    ejecutar(reasignarCaso, new FormData(event.currentTarget));
                  }}
                  className="flex flex-1 items-center gap-1.5"
                >
                  <input type="hidden" name="caso_id" value={caso.id} />
                  <select
                    name="usuario_id"
                    required
                    defaultValue=""
                    aria-label="Reasignar caso"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-600 outline-none"
                  >
                    <option value="" disabled>
                      Reasignar a...
                    </option>
                    {analistas
                      .filter(
                        (analista) =>
                          analista.id !==
                          (caso.assigned_to_id ?? caso.asignado_a),
                      )
                      .map((analista) => (
                        <option key={analista.id} value={analista.id}>
                          {analista.nombre_completo}
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Reasignar
                  </button>
                </form>
              </>
            )}
          </div>
        ) : null}
      </div>

      <BackofficeUpdateForm
        casoId={caso.id}
        estadoActual={caso.estado as EstadoCaso}
        pasoActual={caso.paso_actual}
        asignadoA={caso.asignado_a}
        analistas={analistas}
        bloqueadoPor={bloqueadoPorOtro}
      />

      <DevolucionForm casoId={caso.id} bloqueadoPor={bloqueadoPorOtro} />
    </div>
  );
}
