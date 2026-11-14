"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-lg p-8 text-center">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-rose-500">
          Error inesperado
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          No pudimos completar la operación
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Ocurrió un problema al cargar esta pantalla. Puedes reintentar o
          volver al inicio.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="btn-primary">
            Reintentar
          </button>
          <Link href="/" className="btn-secondary">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
