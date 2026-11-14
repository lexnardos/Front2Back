import Link from "next/link";
import { Brand } from "@/components/brand";
import { IconSearch } from "@/components/icons";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/consulta"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Consultar radicado
          </Link>
          <Link
            href="/escalamiento"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Crear escalamiento
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/consulta"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
          >
            <IconSearch className="h-4 w-4" />
            Consultar
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </header>
  );
}
