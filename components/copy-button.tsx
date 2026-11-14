"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  tone?: "light" | "dark";
}

export function CopyButton({
  value,
  label = "Copiar",
  copiedLabel = "Copiado",
  className,
  tone = "light",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        tone === "dark"
          ? "border-white/[0.15] bg-white/10 text-white hover:bg-white/[0.15]"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
        className,
      )}
      aria-live="polite"
    >
      {copied ? (
        <IconCheck className="h-4 w-4 text-emerald-500" />
      ) : (
        <IconCopy className="h-4 w-4" />
      )}
      {copied ? copiedLabel : label}
    </button>
  );
}
