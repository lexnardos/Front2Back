import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandProps {
  href?: string;
  className?: string;
  showName?: boolean;
}

export function Brand({ href = "/", className, showName = true }: BrandProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        className,
      )}
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-[11px] font-bold tracking-tight text-white shadow-sm transition-transform group-hover:-translate-y-0.5">
        F2B
      </span>
      {showName ? (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold text-slate-900">
            Front2Back
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-400">
            Operaciones F2B
          </span>
        </span>
      ) : null}
    </Link>
  );
}
