import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EscalamientoForm } from "@/components/escalamiento-form";
import {
  IconCheck,
  IconClock,
  IconFileText,
  IconShield,
} from "@/components/icons";
import { WorkspaceHeader } from "@/components/workspace-header";
import { getSessionContext } from "@/lib/auth";
import { PLANTILLAS } from "@/lib/plantillas";

export const metadata: Metadata = {
  title: "Crear escalamiento",
  description:
    "Radica un escalamiento operativo con formulario dinámico y radicado automático.",
};

export const dynamic = "force-dynamic";

export default async function EscalamientoPage() {
  const { user, perfil } = await getSessionContext();

  if (!user) {
    redirect("/login?next=/escalamiento");
  }

  if (!perfil) {
    redirect("/login?error=sin-perfil");
  }

  return (
    <div className="min-h-screen">
      <WorkspaceHeader
        nombre={perfil.nombre_completo}
        correo={perfil.correo}
        rol={perfil.rol}
        avatarUrl={perfil.avatar_url}
        active="escalamiento"
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            Frontoffice
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Nuevo escalamiento
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Hola, {perfil.nombre_completo}. Completa la plantilla y F2B asignará
            el número de radicado de forma automática.
          </p>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <EscalamientoForm />

          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Cómo se genera el radicado
              </h2>
              <ol className="mt-4 space-y-4">
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
                    1
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Consecutivo anual
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      El formato es ESC-AÑO-0001 y se reinicia cada año.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
                    2
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Asignación atómica
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      La base de datos garantiza que no existan radicados
                      duplicados.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
                    3
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Trazabilidad inmediata
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Se registra el primer movimiento del historial.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <IconShield className="h-4 w-4" />
                Antes de radicar
              </h2>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-800/90">
                <li className="flex gap-2">
                  <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Verifica que el caso no tenga un radicado previo.
                </li>
                <li className="flex gap-2">
                  <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Incluye referencias y soportes verificables.
                </li>
                <li className="flex gap-2">
                  <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Describe el hallazgo con el contexto suficiente.
                </li>
              </ul>
            </div>

            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <IconFileText className="h-4 w-4 text-slate-400" />
                Tipologías disponibles
              </h2>
              <ul className="mt-3 space-y-2">
                {PLANTILLAS.map((plantilla) => (
                  <li
                    key={plantilla.nombre}
                    className="flex items-center gap-2 text-xs text-slate-500"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    {plantilla.nombre}
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                <IconClock className="h-3.5 w-3.5" />
                Los campos cambian según la tipología.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
