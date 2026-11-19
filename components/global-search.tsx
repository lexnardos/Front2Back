"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconSearch, IconTicket } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { etiquetaEstado, type CasoBusqueda } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GlobalSearchProps {
  modo: "backoffice" | "consulta";
  valorInicial?: string;
  estado?: string;
  disabled?: boolean;
}

export function GlobalSearch({
  modo,
  valorInicial = "",
  estado,
  disabled = false,
}: GlobalSearchProps) {
  const router = useRouter();
  const [termino, setTermino] = useState(valorInicial);
  const [resultados, setResultados] = useState<CasoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const manejador = (event: PointerEvent) => {
      if (!contenedorRef.current?.contains(event.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("pointerdown", manejador);
    return () => document.removeEventListener("pointerdown", manejador);
  }, []);

  useEffect(() => {
    const texto = termino.trim();
    if (texto.length < 2) {
      setResultados([]);
      setAbierto(false);
      return;
    }

    let activo = true;
    const temporizador = window.setTimeout(async () => {
      if (modo === "backoffice") {
        const params = new URLSearchParams();
        if (estado && estado !== "activos") params.set("estado", estado);
        params.set("q", texto);
        router.replace(`/backoffice?${params.toString()}`);
        return;
      }

      setBuscando(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("buscar_casos", {
          p_termino: texto,
          p_limite: 8,
        });
        if (!activo) return;
        if (error) {
          setSinSesion(true);
          setResultados([]);
        } else {
          setSinSesion(false);
          setResultados((data ?? []) as unknown as CasoBusqueda[]);
        }
      } catch {
        if (activo) setSinSesion(true);
      } finally {
        if (activo) {
          setBuscando(false);
          setAbierto(true);
        }
      }
    }, 350);

    return () => {
      activo = false;
      window.clearTimeout(temporizador);
    };
  }, [termino, modo, estado, router]);

  return (
    <div ref={contenedorRef} className="relative w-full">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={termino}
        disabled={disabled}
        onChange={(event) => setTermino(event.target.value)}
        onFocus={() => resultados.length > 0 && setAbierto(true)}
        placeholder={
          modo === "backoffice"
            ? "Buscar cuenta, cédula, OT, radicado o asesor…"
            : "Buscar por radicado, cuenta, OT o asesor…"
        }
        aria-label="Buscador global instantáneo"
        className="field-input mt-0 w-full py-2 pl-9 pr-3 text-xs"
      />

      {modo === "consulta" && abierto && termino.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
          <Link
            href={`/consulta?radicado=${encodeURIComponent(termino.trim())}`}
            onClick={() => setAbierto(false)}
            className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            <IconSearch className="h-3.5 w-3.5" />
            Consultar radicado «{termino.trim()}»
          </Link>
          {sinSesion ? (
            <p className="px-3 py-3 text-[11px] leading-4 text-slate-500">
              Inicia sesión para buscar por cuenta, cédula, OT o asesor.
            </p>
          ) : buscando ? (
            <p className="px-3 py-3 text-[11px] text-slate-400">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-slate-400">
              Sin coincidencias para este término.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {resultados.map((caso) => (
                <li key={caso.id}>
                  <Link
                    href={`/consulta?radicado=${encodeURIComponent(caso.numero_radicado)}`}
                    onClick={() => {
                      setTermino(caso.numero_radicado);
                      setAbierto(false);
                    }}
                    className="flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50"
                  >
                    <IconTicket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[11px] font-semibold text-slate-800">
                        {caso.numero_radicado}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {caso.tipologia} · {caso.creado_por}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        caso.estado === "Devuelto"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {etiquetaEstado(caso.estado)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
