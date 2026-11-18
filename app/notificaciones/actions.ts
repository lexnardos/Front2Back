"use server";

import { createClient } from "@/lib/supabase/server";

export async function marcarNotificacionLeida(id: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("id", id)
    .eq("usuario_id", user.id);

  return !error;
}

export async function marcarTodasNotificacionesLeidas(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("usuario_id", user.id)
    .eq("leida", false);

  return !error;
}
