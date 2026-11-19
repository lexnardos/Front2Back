"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { programarRecontacto } from "@/app/consulta/actions";
import { IconBell, IconCheck, IconClock } from "@/components/icons";
import type { Callback } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

interface CallbackSchedulerProps {
  casoId: string;
  callbacks: Callback[];
  usuarioId: string;
  radicado: string;
}

function aInputLocal(fecha: Date): string {
  const ajustada = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return ajustada.toISOString().slice(0, 16);
}

function etiquetaEstadoCallback(estado: string): string {
  if (estado === "pendiente") return "Pendiente";
  if (estado === "pospuesto") return "Pospuesto";
  if (estado === "completado") return "Realizado";
  if (estado === "cancelado") return "Cancelado";
  return estado;
}

export function CallbackScheduler({
  casoId,
  callbacks,
  usuarioId,
  radicado,
}: CallbackSchedulerProps) {
  const router = useRouter();
  const [fecha, setFecha] = useState(() =>
    aInputLocal(new Date(Date.now() + 30 * 60 * 1000)),
  );
  const [notas, setNotas] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const programadas = callbacks.filter(
    (callback) => callback.estado === "pendiente" || callback.estado === "pospuesto",
  );

  function elegir(minutos: number | "manana") {
    if (minutos === "manana") {
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      manana.setHours(9, 0, 0, 0);
      setFecha(aInputLocal(manana));
      return;
    }
    setFecha(aInputLocal(new Date(Date.now() + minutos * 60 * 1000)));
  }

  function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensaje(null);

    const datos = new FormData(event.currentTarget);
    datos.set("caso_id", casoId);
    datos.set("programado_para", new Date(fecha).toISOString());
    datos.set("notas", notas);

    startTransition(async () => {
      try {
        const resultado = await programarRecontacto(datos);
        setMensaje({
          ok: resultado.ok,
          texto: resultado.ok
            ? resultado.message ?? "Recontacto programado."
            : resultado.error ?? "No fue posible programar el recontacto.",
        });
        if (resultado.ok) {
          setNotas("");
          router.refresh();
        }
      } catch {
        setMensaje({
          ok: false,
          texto: "No fue posible conectar con el servidor. Inténtalo nuevamente.",
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
      <div className="flex items-start gap-2.5">
        <IconBell className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div>
          <h3 className="text-xs font-semibold text-brand-900">
            Programar recontacto al cliente
          </h3>
          <p className="mt-0.5 text-[11px] leading-4 text-brand-800/80">
            El agente {usuarioId ? "asignado" : "responsable"} recibirá un recordatorio
            automático para {radicado}.
          </p>
        </div>
      </div>

      {programadas.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {programadas.map((callback) => (
            <li
              key={callback.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-brand-100 bg-white px-2.5 py-2 text-[11px] text-slate-600"
            >
              <span className="flex items-center gap-1.5">
                <IconClock className="h-3.5 w-3.5 text-brand-500" />
                {formatDateTime(callback.programado_para)}
              </span>
              <span
                className={cn(
                  "font-semibold",
                  callback.estado === "pospuesto"
                    ? "text-amber-700"
                    : "text-brand-700",
                )}
              >
                {etiquetaEstadoCallback(callback.estado)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={enviar} className="mt-3 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => elegir(30)}
            className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            En 30 min
          </button>
          <button
            type="button"
            onClick={() => elegir(120)}
            className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            En 2 h
          </button>
          <button
            type="button"
            onClick={() => elegir("manana")}
            className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            Mañana 9:00
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            type="datetime-local"
            aria-label="Fecha y hora del recontacto"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            required
            className="field-input"
          />
          <button
            type="submit"
            disabled={isPending || !fecha}
            className="btn-primary whitespace-nowrap px-3 py-2 text-[11px] disabled:opacity-50"
          >
            Programar
          </button>
        </div>

        <textarea
          aria-label="Notas del recontacto"
          value={notas}
          onChange={(event) => setNotas(event.target.value)}
          rows={2}
          maxLength={280}
          placeholder="Motivo del recontacto o instrucciones para el agente"
          className="field-textarea"
        />

        {mensaje ? (
          <p
            role={mensaje.ok ? "status" : "alert"}
            className={cn(
              "flex items-start gap-1.5 text-[11px] font-medium",
              mensaje.ok ? "text-emerald-700" : "text-rose-700",
            )}
          >
            {mensaje.ok ? <IconCheck className="mt-0.5 h-3.5 w-3.5" /> : null}
            {mensaje.texto}
          </p>
        ) : null}
      </form>
    </div>
  );
}
