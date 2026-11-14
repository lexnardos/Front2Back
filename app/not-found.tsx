import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { IconSearch } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">
          Error 404
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          No encontramos esta página
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
          El recurso que buscas no existe o el caso solicitado ya no está
          disponible.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn-primary">
            Volver al inicio
          </Link>
          <Link href="/consulta" className="btn-secondary">
            <IconSearch className="h-4 w-4 text-slate-500" />
            Consultar radicado
          </Link>
        </div>
      </main>
    </div>
  );
}
