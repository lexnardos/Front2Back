"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RolUsuario } from "@/lib/types";

function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    redirect(
      `/login?error=faltan-datos${next ? `&next=${encodeURIComponent(next)}` : ""}`,
    );
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login?error=configuracion");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect(
      `/login?error=credenciales${next ? `&next=${encodeURIComponent(next)}` : ""}`,
    );
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!perfil) {
    await supabase.auth.signOut();
    redirect("/login?error=sin-perfil");
  }

  const rol = (perfil as { rol: RolUsuario }).rol;
  const fallback = rol === "backoffice" ? "/backoffice" : "/escalamiento";

  redirect(next ?? fallback);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
