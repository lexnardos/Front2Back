"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { IconCamera, IconFileText, IconX } from "@/components/icons";
import { guardarEvidencias } from "@/app/backoffice/actions";
import {
  eliminarEvidencia,
  subirEvidencia,
  validarImagen,
} from "@/lib/evidencias";
import { cn } from "@/lib/utils";
import type { Evidencia } from "@/lib/types";

interface ArchivoLocal {
  id: string;
  file: File;
  preview: string;
}

interface EvidenceUploaderProps {
  radicado?: string;
  evidenciasIniciales?: Evidencia[];
  onArchivosChange?: (archivos: File[]) => void;
  onEvidenciasChange?: (evidencias: Evidencia[]) => void;
  disabled?: boolean;
  maximo?: number;
}

export function EvidenceUploader({
  radicado,
  evidenciasIniciales = [],
  onArchivosChange,
  onEvidenciasChange,
  disabled = false,
  maximo = 6,
}: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const localesRef = useRef<ArchivoLocal[]>([]);
  const [locales, setLocales] = useState<ArchivoLocal[]>([]);
  const [evidencias, setEvidencias] = useState<Evidencia[]>(evidenciasIniciales);
  const [arrastrando, setArrastrando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvidencias(evidenciasIniciales);
  }, [evidenciasIniciales]);

  useEffect(() => {
    localesRef.current = locales;
  }, [locales]);

  useEffect(() => {
    return () => {
      localesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  const total = locales.length + evidencias.length;

  function notificarLocales(siguientes: ArchivoLocal[]) {
    setLocales(siguientes);
    onArchivosChange?.(siguientes.map((item) => item.file));
  }

  async function agregarArchivos(archivos: File[]) {
    if (disabled || procesando) return;
    setError(null);

    const imagenes = archivos.filter((archivo) => archivo.type.startsWith("image/"));
    if (imagenes.length === 0) {
      setError("Selecciona archivos de imagen (PNG, JPG, WEBP, GIF o AVIF).");
      return;
    }

    const espacio = maximo - total;
    if (espacio <= 0) {
      setError(`Máximo ${maximo} evidencias por caso.`);
      return;
    }

    const validos: File[] = [];
    for (const archivo of imagenes.slice(0, espacio)) {
      const problema = validarImagen(archivo);
      if (problema) {
        setError(problema);
        continue;
      }
      validos.push(archivo);
    }
    if (validos.length === 0) return;

    if (!radicado) {
      const nuevos = validos.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }));
      notificarLocales([...locales, ...nuevos]);
      return;
    }

    setProcesando(true);
    try {
      const subidas: Evidencia[] = [];
      for (const archivo of validos) {
        subidas.push(await subirEvidencia(radicado, archivo));
      }
      const siguientes = [...evidencias, ...subidas];
      await guardarEvidencias(radicado, siguientes);
      setEvidencias(siguientes);
      onEvidenciasChange?.(siguientes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible subir las evidencias.");
    } finally {
      setProcesando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setArrastrando(false);
    void agregarArchivos(Array.from(event.dataTransfer.files));
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const archivos = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((archivo): archivo is File => archivo !== null);
    if (archivos.length === 0) return;
    event.preventDefault();
    void agregarArchivos(archivos);
  }

  async function quitarLocal(id: string) {
    const objetivo = locales.find((item) => item.id === id);
    if (objetivo) URL.revokeObjectURL(objetivo.preview);
    notificarLocales(locales.filter((item) => item.id !== id));
  }

  async function quitarEvidencia(evidencia: Evidencia) {
    if (!radicado) return;
    setProcesando(true);
    setError(null);
    try {
      const siguientes = evidencias.filter((item) => item.path !== evidencia.path);
      await eliminarEvidencia(evidencia);
      await guardarEvidencias(radicado, siguientes);
      setEvidencias(siguientes);
      onEvidenciasChange?.(siguientes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible eliminar la evidencia.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Zona de carga de evidencias"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onPaste={handlePaste}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          arrastrando
            ? "border-brand-400 bg-brand-50"
            : "border-slate-200 bg-slate-50/70 hover:border-brand-300 hover:bg-brand-50/40",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">
          <IconCamera className="h-5 w-5" />
        </span>
        <p className="mt-3 text-xs font-semibold text-slate-700">
          Arrastra imágenes, haz clic para seleccionarlas o pega con Ctrl + V
        </p>
        <p className="mt-1 text-[11px] leading-4 text-slate-400">
          Para recortes con Win + Shift + S, copia el recorte y pulsa Ctrl + V aquí.
          Máximo {maximo} imágenes · 10 MB cada una.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          disabled={disabled || procesando || total >= maximo}
          onChange={(event) => void agregarArchivos(Array.from(event.target.files ?? []))}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : null}

      {procesando ? (
        <p className="mt-2 text-xs font-medium text-brand-700">Subiendo evidencias…</p>
      ) : null}

      {total > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {locales.map((item) => (
            <li key={item.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.preview}
                alt={item.file.name}
                className="h-20 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => void quitarLocal(item.id)}
                aria-label={`Quitar ${item.file.name}`}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white transition hover:bg-rose-600"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
              <p className="truncate px-2 py-1 text-[10px] text-slate-500">{item.file.name}</p>
            </li>
          ))}
          {evidencias.map((item) => (
            <li key={item.path} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.nombre} className="h-20 w-full object-cover" />
              <button
                type="button"
                onClick={() => void quitarEvidencia(item)}
                aria-label={`Eliminar ${item.nombre}`}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white transition hover:bg-rose-600"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
              <p className="truncate px-2 py-1 text-[10px] text-slate-500">{item.nombre}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
          <IconFileText className="h-3.5 w-3.5" />
          Aún no hay evidencias adjuntas.
        </p>
      )}
    </div>
  );
}
