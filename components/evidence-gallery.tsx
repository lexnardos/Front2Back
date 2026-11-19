"use client";

import { useState } from "react";
import { Lightbox } from "@/components/lightbox";
import { IconCamera } from "@/components/icons";
import type { Evidencia } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function EvidenceGallery({ evidencias }: { evidencias: Evidencia[] }) {
  const [indice, setIndice] = useState<number | null>(null);
  const items = evidencias.filter(
    (item): item is Evidencia => typeof item?.url === "string",
  );

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-400">
        <IconCamera className="h-4 w-4" />
        No hay evidencias adjuntas a este caso.
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.path || item.url}>
            <button
              type="button"
              onClick={() => setIndice(index)}
              className="group w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.nombre}
                className="h-28 w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
              <span className="block truncate px-2.5 py-2 text-[11px] font-medium text-slate-600">
                {item.nombre}
              </span>
              <span className="block px-2.5 pb-2 text-[10px] text-slate-400">
                {formatDateTime(item.subida_en)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {indice !== null ? (
        <Lightbox
          evidencias={items}
          indice={indice}
          onCerrar={() => setIndice(null)}
          onCambiar={setIndice}
        />
      ) : null}
    </>
  );
}
