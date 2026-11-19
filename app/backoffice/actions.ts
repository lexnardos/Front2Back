"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ESTADOS_CASO,
  type ActualizarCasoState,
  type EstadoCaso,
  type Evidencia,
} from "@/lib/types";
import { isUuid } from "@/lib/utils";

const MAX_EVIDENCIAS = 6;

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

  if (estadoRaw === "Devuelto") {
    return {
      ok: false,
      error: "Para devolver un caso usa el formulario «Devolver con causal».",
    };
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

export async function devolverCaso(
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
      error: "Solo los analistas de Backoffice pueden devolver casos.",
    };
  }

  const casoId = String(formData.get("caso_id") ?? "");
  const causal = String(formData.get("causal") ?? "").trim();
  const observacion = String(formData.get("observacion") ?? "").trim();

  if (!isUuid(casoId)) {
    return { ok: false, error: "El caso no es válido." };
  }
  if (!causal) {
    return { ok: false, error: "Selecciona la causal de devolución." };
  }
  if (!observacion) {
    return { ok: false, error: "La observación es obligatoria." };
  }
  if (observacion.length > 2000) {
    return {
      ok: false,
      error: "La observación no puede superar los 2000 caracteres.",
    };
  }

  const { error } = await supabase.rpc("devolver_caso", {
    p_caso_id: casoId,
    p_causal: causal,
    p_observacion: observacion,
  });

  if (error) {
    console.error("Error al devolver el caso:", error.message);
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "production"
          ? "No fue posible devolver el caso. Inténtalo nuevamente."
          : error.message,
    };
  }

  revalidatePath("/backoffice");
  revalidatePath(`/backoffice/${casoId}`);
  revalidatePath("/consulta");

  return {
    ok: true,
    message: `Caso devuelto al Frontoffice (${causal}). SLA en pausa y notificación enviada.`,
  };
}

function esEvidenciaValida(valor: unknown): valor is Evidencia {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Partial<Evidencia>;
  return (
    typeof item.url === "string" &&
    typeof item.path === "string" &&
    typeof item.nombre === "string" &&
    typeof item.tipo === "string" &&
    typeof item.tamano === "number" &&
    typeof item.subida_en === "string"
  );
}

export async function guardarEvidencias(
  radicado: string,
  evidencias: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }
  if (!radicado.trim()) {
    return { ok: false, error: "El radicado no es válido." };
  }
  if (!Array.isArray(evidencias) || evidencias.length > MAX_EVIDENCIAS) {
    return { ok: false, error: "La lista de evidencias no es válida." };
  }
  if (!evidencias.every(esEvidenciaValida)) {
    return { ok: false, error: "Una de las evidencias no tiene un formato válido." };
  }

  const { error } = await supabase.rpc("guardar_evidencias", {
    p_radicado: radicado.trim(),
    p_evidencias: evidencias,
  });

  if (error) {
    console.error("Error al guardar evidencias:", error.message);
    return { ok: false, error: "No fue posible guardar las evidencias del caso." };
  }

  revalidatePath("/backoffice");
  revalidatePath("/consulta");
  return { ok: true };
}
