"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ESTADOS_CASO,
  type ActualizarCasoState,
  type EstadoCaso,
} from "@/lib/types";
import { isUuid } from "@/lib/utils";

export async function actualizarCaso(
  formData: FormData,
): Promise<ActualizarCasoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Tu sesión expiró. Inicia sesión nuevamente para continuar.",
    };
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || (perfil as { rol: string }).rol !== "backoffice") {
    return {
      ok: false,
      error: "Solo los analistas de Backoffice pueden gestionar casos.",
    };
  }

  const casoId = String(formData.get("caso_id") ?? "");
  const estadoRaw = String(formData.get("estado") ?? "");
  const pasoActual = String(formData.get("paso_actual") ?? "").trim();
  const comentario = String(formData.get("comentario") ?? "").trim();
  const asignadoRaw = String(formData.get("asignado_a") ?? "").trim();

  if (!isUuid(casoId)) {
    return { ok: false, error: "El caso no es válido." };
  }

  if (!ESTADOS_CASO.includes(estadoRaw as EstadoCaso)) {
    return { ok: false, error: "Selecciona un estado válido." };
  }

  if (pasoActual.length === 0) {
    return { ok: false, error: "El paso actual es obligatorio." };
  }

  if (pasoActual.length > 120) {
    return {
      ok: false,
      error: "El paso actual no puede superar los 120 caracteres.",
    };
  }

  if (comentario.length > 2000) {
    return {
      ok: false,
      error: "El comentario no puede superar los 2000 caracteres.",
    };
  }

  if (asignadoRaw && !isUuid(asignadoRaw)) {
    return { ok: false, error: "El analista asignado no es válido." };
  }

  const { error } = await supabase.rpc("actualizar_caso_escalamiento", {
    p_caso_id: casoId,
    p_estado: estadoRaw as EstadoCaso,
    p_paso_actual: pasoActual,
    p_comentario: comentario || null,
    p_asignado_a: asignadoRaw || null,
  });

  if (error) {
    console.error("Error al actualizar el caso:", error.message);
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "production"
          ? "No fue posible actualizar el caso. Inténtalo nuevamente."
          : error.message,
    };
  }

  revalidatePath("/backoffice");
  revalidatePath(`/backoffice/${casoId}`);
  revalidatePath("/consulta");

  return {
    ok: true,
    message: "Caso actualizado y movimiento registrado en el historial.",
  };
}
