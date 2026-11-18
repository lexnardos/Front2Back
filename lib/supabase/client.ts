"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function createClient() {
  const { url, key } = getSupabaseEnv();

  if (!url || !key) {
    throw new Error(
      "Faltan las variables públicas de Supabase en el entorno del navegador.",
    );
  }

  return createBrowserClient(url, key);
}
