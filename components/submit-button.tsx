"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}

export function SubmitButton({
  children,
  pendingText = "Guardando...",
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn("btn-primary w-full", className)}
      aria-live="polite"
    >
      {pending ? (
        <>
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
            aria-hidden
          />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
