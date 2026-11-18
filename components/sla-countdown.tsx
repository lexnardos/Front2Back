"use client";

import { useEffect, useState } from "react";
import { IconClock } from "@/components/icons";
import { calcularSla, type SlaInfo, type SlaTono } from "@/lib/sla";
import type { EstadoCaso } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const tonos: Record<SlaTono, { caja: string; barra: string; punto: string }> = {
  "en-tiempo": {
    caja: "border-emerald-200/80 bg-emerald-50/80 text-emerald-700",
    barra: "bg-emerald-500",
    punto: "bg-emerald-500",
  },
  "por-vencer": {
    caja: "border-amber-200/80 bg-amber-50/80 text-amber-700",
    barra: "bg-amber-500",
    punto: "bg-amber-500",
  },
  vencido: {
    caja: "border-rose-200/80 bg-rose-50/80 text-rose-700",
    barra: "bg-rose-500",
    punto: "bg-rose-500",
  },
  respondido: {
    caja: "border-brand-200/80 bg-brand-50/80 text-brand-700",
    barra: "bg-brand-500",
    punto: "bg-brand-500",
  },
};

interface SlaCountdownProps {
  createdAt: string;
  slaDeadline?: string | null;
  primeraRespuestaAt?: string | null;
  estado: EstadoCaso;
  updatedAt?: string | null;
  compact?: boolean;
  className?: string;
}

export function SlaCountdown({
  createdAt,
  slaDeadline,
  primeraRespuestaAt,
  estado,
  updatedAt,
  compact = false,
  className,
}: SlaCountdownProps) {
  const [info, setInfo] = useState<SlaInfo | null>(null);

  useEffect(() => {
    const actualizar = () =>
      setInfo(
        calcularSla({
          createdAt,
          slaDeadline,
          primeraRespuestaAt,
          estado,
          updatedAt,
        }),
      );

    actualizar();
    const temporizador = window.setInterval(actualizar, 1000);
    return () => window.clearInterval(temporizador);
  }, [createdAt, slaDeadline, primeraRespuestaAt, estado, updatedAt]);

  const limiteTexto = slaDeadline
    ? `Límite: ${formatDateTime(slaDeadline)}`
    : "Límite: 72 horas desde la radicación";

  if (!info) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400",
          className,
        )}
      >
        <IconClock className="h-3.5 w-3.5" />
        Calculando SLA…
      </span>
    );
  }

  const estilo = tonos[info.tono];

  if (compact) {
    return (
      <span
        title={`${info.etiqueta} · ${info.cronometro} · ${limiteTexto}`}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset transition-colors duration-500",
          estilo.caja,
          className,
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", estilo.punto)} />
        <span className="truncate font-mono">{info.cronometro}</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 transition-colors duration-500",
        estilo.caja,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
            <IconClock className="h-3.5 w-3.5" />
            Compromiso de respuesta
          </p>
          <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums sm:text-base">
            {info.cronometro}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          {info.etiqueta}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-1000 ease-linear",
            estilo.barra,
          )}
          style={{ width: `${Math.round(info.progreso)}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-4 opacity-70">
        {info.detalle} · {limiteTexto}
      </p>
    </div>
  );
}
