"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface BackofficeNavLinksProps {
  compacto?: boolean;
}

export function BackofficeNavLinks({ compacto = false }: BackofficeNavLinksProps) {
  const pathname = usePathname();
  const enGestion = pathname.startsWith("/backoffice/gestion");

  const enlaces = [
    { href: "/backoffice", label: "Bandeja", activo: !enGestion },
    { href: "/backoffice/gestion", label: "Gestión", activo: enGestion },
  ];

  return (
    <>
      {enlaces.map((enlace) => (
        <Link
          key={enlace.href}
          href={enlace.href}
          className={cn(
            "font-medium transition",
            compacto
              ? "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold"
              : "rounded-lg px-3 py-2 text-sm",
            enlace.activo
              ? "bg-brand-50 text-brand-700"
              : compacto
                ? "text-slate-500 hover:bg-slate-100"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {enlace.label}
        </Link>
      ))}
    </>
  );
}
