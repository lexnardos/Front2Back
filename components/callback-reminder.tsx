"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  completarRecontacto,
  posponerRecontacto,
} from "@/app/consulta/actions";
import { IconBell, IconCheck, IconClock } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import type { Callback } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface CallbackReminderProps {
  usuarioId: string;
}

export function CallbackReminder({ usuarioId }: CallbackReminderProps) {
  const router = useRouter();
  const [callback, setCallback] = useState<Callback | null>(null);
  const [descartado, setDescartado] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!usuarioId) return;

    const supabase = createClient();

    async function cargar() {
      const haceUnRato = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("callbacks")
        .select(
          "id, caso_id, programado_para, estado, notas, caso:casos_escalamiento(numero_radicado, tipologia)",
        )
        .eq("usuario_id", usuarioId)
        .in("estado", ["pendiente", "pospuesto"])
        .lte("programado_para", new Date().toISOString())
        .gte("programado_para", haceUnRato)
        .order("programado_para", { ascending: true })
        .limit(1);

      if (error || !data?.length) {
        setCallback(null);
        setDescartado(null);
        return;
      }
      if (data[0].id === descartado) return;
      setCallback(data[0] as unknown as Callback);
    }

    void cargar();

    const canal = supabase
      .channel(`f2b-callback-${usuarioId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "callbacks",
          filter: `usuario_id=eq.${usuarioId}`,
        },
        () => {
          void cargar();
        },
      )
      .subscribe();

    const intervalo = window.setInterval(() => void cargar(), 60000);

    return () => {
      window.clearInterval(intervalo);
      void supabase.removeChannel(canal);
    };
  }, [usuarioId, descartado]);

  if (!callback || descartado === callback.id) return null;

  const ejecutar = (accion: (formData: FormData) => Promise<unknown>, datos: FormData) => {
    startTransition(async () => {
      try {
        await accion(datos);
        setCallback(null);
        setDescartado(null);
      } catch {
        setCallback((actual) => actual);
      }
    });
  };

  const marcarRealizado = () => {
    const datos = new FormData();
    datos.set("callback_id", callback.id);
    ejecutar(completarRecontacto, datos);
  };

  const posponer = () => {
    const datos = new FormData();
    datos.set("callback_id", callback.id);
    datos.set("minutos", "15");
    ejecutar(posponerRecontacto, datos);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md sm:inset-x-auto sm:right-5 sm:bottom-5">
      <div
        role="alert"
        className="animate-fade-up overflow-hidden rounded-2xl border border-amber-300 bg-white shadow-soft"
      >
        <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
            <IconBell className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-900">
              Recordatorio de recontacto
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-amber-800/90">
              {callback.caso?.numero_radicado
                ? `Radicado ${callback.caso.numero_radicado} · `
                : ""}
              Programado para {formatDateTime(callback.programado_para)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDescartado(callback.id)}
            aria-label="Cerrar recordatorio"
            className="rounded-md p-1 text-amber-700 transition hover:bg-amber-100"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>

        <div className="px-4 py-3">
          {callback.notas ? (
            <p className="text-[11px] leading-5 text-slate-600">{callback.notas}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (callback.caso?.numero_radicado) {
                  router.push(`/consulta?radicado=${callback.caso.numero_radicado}`);
                }
              }}
              className="rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              Llamar ahora
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={posponer}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <IconClock className="h-3.5 w-3.5" />
              Posponer 15 min
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={marcarRealizado}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              <IconCheck className="h-3.5 w-3.5" />
              Marcar realizado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
