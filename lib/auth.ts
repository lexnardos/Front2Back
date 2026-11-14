import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Usuario } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface SessionContext {
  user: User | null;
  perfil: Usuario | null;
  supabase: SupabaseServerClient;
}

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, perfil: null, supabase };
  }

  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre_completo, correo, rol, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    perfil: (data as Usuario | null) ?? null,
    supabase,
  };
});
