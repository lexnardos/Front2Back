"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronLeft, IconX } from "@/components/icons";
import type { Evidencia } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LightboxProps {
  evidencias: Evidencia[];
  indice: number;
  onCerrar: () => void;
  onCambiar: (indice: number) => void;
}

export function Lightbox({ evidencias, indice, onCerrar, onCambiar }: LightboxProps) {
  const [zoom, setZoom] = useState(1);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const evidencia = evidencias[indice];

  useEffect(() => {
    setZoom(1);
  }, [indice]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCerrar();
      if (event.key === "ArrowRight") onCambiar((indice + 1) % evidencias.length);
      if (event.key === "ArrowLeft") onCambiar((indice - 1 + evidencias.length) % evidencias.length);
      if (event.key === "+" || event.key === "=") setZoom((valor) => Math.min(4, valor + 0.25));
      if (event.key === "-") setZoom((valor) => Math.max(0.5, valor - 0.25));
    }
    document.addEventListener("keydown", handleKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = overflow;
    };
  }, [evidencias.length, indice, onCambiar, onCerrar]);

  if (!evidencia || typeof document === "undefined") return null;

  const siguiente = () => onCambiar((indice + 1) % evidencias.length);
  const anterior = () => onCambiar((indice - 1 + evidencias.length) % evidencias.length);

  return createPortal(
    <div
      ref={contenedorRef}
      role="dialog"
      aria-modal="true"
      aria-label="Visor de evidencias"
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 text-white"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{evidencia.nombre}</p>
          <p className="text-[11px] text-slate-400">
            {indice + 1} de {evidencias.length} · usa las flechas para navegar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((valor) => Math.max(0.5, valor - 0.25))}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-lg hover:bg-white/10"
            aria-label="Reducir zoom"
          >
            −
          </button>
          <span className="w-12 text-center text-xs font-mono text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((valor) => Math.min(4, valor + 0.25))}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-lg hover:bg-white/10"
            aria-label="Aumentar zoom"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              const elemento = contenedorRef.current;
              if (!elemento) return;
              if (document.fullscreenElement) void document.exitFullscreen();
              else void elemento.requestFullscreen();
            }}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/10"
          >
            Pantalla completa
          </button>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar visor"
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 hover:bg-white/10"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 pb-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onCerrar();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={evidencia.url}
          alt={evidencia.nombre}
          style={{ transform: `scale(${zoom})` }}
          className={cn(
            "max-h-full max-w-full select-none object-contain transition-transform duration-150",
            zoom > 1 ? "cursor-zoom-in" : "cursor-default",
          )}
        />
      </div>

      {evidencias.length > 1 ? (
        <div className="flex items-center justify-center gap-4 pb-5">
          <button
            type="button"
            onClick={anterior}
            aria-label="Evidencia anterior"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 hover:bg-white/10"
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex max-w-[60vw] gap-2 overflow-x-auto">
            {evidencias.map((item, index) => (
              <button
                key={item.path}
                type="button"
                onClick={() => onCambiar(index)}
                aria-label={`Ver ${item.nombre}`}
                className={cn(
                  "h-12 w-16 shrink-0 overflow-hidden rounded-md border-2",
                  index === indice ? "border-brand-400" : "border-transparent opacity-60",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={siguiente}
            aria-label="Evidencia siguiente"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 hover:bg-white/10"
          >
            <IconChevronLeft className="h-5 w-5 rotate-180" />
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
