import type { EstadoCaso } from "@/lib/types";
import { cn } from "@/lib/utils";

const badgeStyles: Record<EstadoCaso, string> = {
  Pendiente: "bg-amber-50 text-amber-700 ring-amber-600/20",
  "En Proceso": "bg-sky-50 text-sky-700 ring-sky-600/20",
  Completado: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Rechazado: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const dotStyles: Record<EstadoCaso, string> = {
  Pendiente: "bg-amber-500",
  "En Proceso": "bg-sky-500",
  Completado: "bg-emerald-500",
  Rechazado: "bg-rose-500",
};

interface StatusBadgeProps {
  estado: EstadoCaso;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  estado,
  size = "md",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        badgeStyles[estado],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          dotStyles[estado],
        )}
      />
      {estado}
    </span>
  );
}
