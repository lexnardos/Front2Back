import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { StatusBadge } from "@/components/status-badge";
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconDashboard,
  IconFileText,
  IconSearch,
  IconShield,
  IconTicket,
} from "@/components/icons";

const modulos = [
  {
    href: "/escalamiento",
    title: "Crear escalamiento",
    description:
      "Formularios dinámicos por tipología y radicado consecutivo automático.",
    icon: IconTicket,
    accent: "bg-brand-50 text-brand-700",
  },
  {
    href: "/backoffice",
    title: "Panel Backoffice",
    description:
      "Bandeja de casos, actualización de pasos y registro automático del historial.",
    icon: IconDashboard,
    accent: "bg-sky-50 text-sky-700",
  },
  {
    href: "/consulta",
    title: "Consultar radicado",
    description:
      "Estado en tiempo real, línea de tiempo y observaciones de resolución.",
    icon: IconSearch,
    accent: "bg-emerald-50 text-emerald-700",
  },
];

const pasos = [
  {
    numero: "01",
    titulo: "El agente radica",
    texto:
      "Completa la plantilla de la tipología y obtiene un radicado único ESC-AÑO-0001.",
  },
  {
    numero: "02",
    titulo: "Backoffice gestiona",
    texto:
      "El analista actualiza el estado, el paso actual y deja la observación de gestión.",
  },
  {
    numero: "03",
    titulo: "Todos consultan",
    texto:
      "El radicado queda disponible con su trazabilidad completa y fecha de cada movimiento.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden border-b border-slate-200/70 bg-white">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.14),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(14,165,233,0.12),transparent_30%)]"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent"
          />

          <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700 shadow-sm backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Front2Back · F2B
              </span>

              <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
                Trazabilidad operativa entre{" "}
                <span className="bg-gradient-to-r from-brand-600 to-sky-500 bg-clip-text text-transparent">
                  Frontoffice y Backoffice
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Radica, gestiona y consulta escalamientos con un historial
                auditable en cada paso. Un solo flujo para que cada caso tenga
                responsable, estado y trazabilidad.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/escalamiento" className="btn-primary">
                  Crear un escalamiento
                  <IconArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/consulta" className="btn-secondary">
                  <IconSearch className="h-4 w-4 text-slate-500" />
                  Consultar por radicado
                </Link>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
                <li className="inline-flex items-center gap-1.5">
                  <IconCheck className="h-4 w-4 text-emerald-500" />
                  Radicado automático
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <IconCheck className="h-4 w-4 text-emerald-500" />
                  Historial auditable
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <IconCheck className="h-4 w-4 text-emerald-500" />
                  Acceso por rol
                </li>
              </ul>
            </div>

            <div className="relative animate-fade-up lg:justify-self-end">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-100/80 via-white to-sky-100/60 blur-2xl"
              />
              <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Caso de ejemplo
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                      ESC-2026-0142
                    </p>
                  </div>
                  <StatusBadge estado="En Proceso" />
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                      <IconFileText className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Escucha de llamada
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        Validación de la gestión y escalamiento al Back Office.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                        <IconCheck className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">
                          Radicado creado
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Frontoffice · 12 feb 2026
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 h-4 w-px bg-slate-200" />
                    <div className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-sky-100 text-sky-600">
                        <IconClock className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">
                          En revisión con área responsable
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Backoffice · 13 feb 2026
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 h-4 w-px bg-slate-200" />
                    <div className="flex items-center gap-3 opacity-50">
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                      </span>
                      <p className="text-xs font-semibold text-slate-500">
                        Siguiente paso pendiente
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <IconShield className="h-3.5 w-3.5 text-emerald-500" />
                      Historial protegido
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      F2B
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              Módulos
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Un flujo, tres puntos de control
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Cada módulo cumple una función específica dentro del ciclo del
              escalamiento, sin duplicar información ni perder el contexto.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {modulos.map((modulo) => {
              const Icon = modulo.icon;
              return (
                <Link
                  key={modulo.href}
                  href={modulo.href}
                  className="group card p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft"
                >
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-xl ${modulo.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                    {modulo.title}
                    <IconArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {modulo.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="border-y border-slate-200/70 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                  Cómo funciona
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Del reporte a la resolución, sin puntos ciegos
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  F2B conecta la solicitud inicial con la gestión del área
                  responsable y deja evidencia de cada cambio.
                </p>
                <Link
                  href="/consulta"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
                >
                  Consultar un radicado
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {pasos.map((paso) => (
                  <div
                    key={paso.numero}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <span className="font-mono text-xs font-semibold text-brand-600">
                      {paso.numero}
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-slate-900">
                      {paso.titulo}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {paso.texto}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-slate-400 sm:flex-row sm:px-6">
        <p>F2B · Front2Back. Trazabilidad operativa Frontoffice–Backoffice.</p>
        <div className="flex items-center gap-4">
          <Link href="/consulta" className="hover:text-slate-600">
            Consultar
          </Link>
          <Link href="/login" className="hover:text-slate-600">
            Acceso interno
          </Link>
        </div>
      </footer>
    </div>
  );
}
