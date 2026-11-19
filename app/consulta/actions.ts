"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPlantilla } from "@/lib/plantillas";
import type { ActualizarCasoState } from "@/lib/types";
import { isUuid } from "@/lib/utils";

export async function reenviarCaso(
  formData: FormData,
): Promise<ActualizarCasoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Inicia sesión para corregir y reenviar el caso.",
    };
  }

  const casoId = String(formData.get("caso_id") ?? "");
  const tipologia = String(formData.get("tipologia") ?? "").trim();
  const radicado = String(formData.get("radicado") ?? "").trim();
  const comentario = String(formData.get("comentario") ?? "").trim();

  if (!isUuid(casoId) || !radicado) {
    return { ok: false, error: "El caso no es válido." };
  }
  if (comentario.length > 2000) {
    return { ok: false, error: "La observación no puede superar los 2000 caracteres." };
  }

  const plantilla = getPlantilla(tipologia);
  const datos: Record<string, string> = {};
  if (plantilla) {
    for (const campo of plantilla.campos) {
      const valor = formData.get(`campo_${campo.name}`);
      if (typeof valor === "string" && valor.trim()) {
        datos[campo.name] = valor.trim();
      }
    }
  }

  const { error } = await supabase.rpc("reenviar_caso", {
    p_caso_id: casoId,
    p_datos_plantilla: Object.keys(datos).length > 0 ? datos : null,
    p_comentario: comentario || null,
  });

  if (error) {
    console.error("Error al reenviar el caso:", error.message);
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "production"
          ? "No fue posible reenviar el caso. Inténtalo nuevamente."
          : error.message,
    };
  }

  const evidenciasRaw = String(formData.get("evidencias") ?? "").trim();
  if (evidenciasRaw) {
    try {
      const evidencias = JSON.parse(evidenciasRaw) as unknown;
      const { guardarEvidencias } = await import("@/app/backoffice/actions");
      const resultado = await guardarEvidencias(radicado, evidencias);
      if (!resultado.ok) {
        return {
          ok: true,
          message:
            "Caso reenviado, pero no fue posible actualizar las evidencias adjuntas.",
        };
      }
    } catch {
      return {
        ok: true,
        message:
          "Caso reenviado, pero las evidencias adjuntas no pudieron ser guardadas.",
      };
    }
  }

  revalidatePath("/consulta");
  revalidatePath("/backoffice");
  revalidatePath(`/backoffice/${casoId}`);

  return {
    ok: true,
    message:
      "Caso corregido y reenviado al Backoffice. El SLA fue reanudado.",
  };
}

export async function programarRecontacto(
  formData: FormData,
): Promise<ActualizarCasoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Inicia sesión para programar el recontacto." };
  }

  const casoId = String(formData.get("caso_id") ?? "");
  const fechaRaw = String(formData.get("programado_para") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();

  if (!isUuid(casoId)) {
    return { ok: false, error: "El caso no es válido." };
  }

  const fecha = new Date(fechaRaw);
  if (!fechaRaw || Number.isNaN(fecha.getTime())) {
    return { ok: false, error: "Selecciona una fecha y hora válidas." };
  }

  if (notas.length > 1000) {
    return { ok: false, error: "Las notas no pueden superar los 1000 caracteres." };
  }

  const { error } = await supabase.rpc("programar_callback", {
    p_caso_id: casoId,
    p_programado_para: fecha.toISOString(),
    p_notas: notas || null,
  });

  if (error) {
    console.error("Error al programar el recontacto:", error.message);
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "production"
          ? "No fue posible programar el recontacto. Inténtalo nuevamente."
          : error.message,
    };
  }

  revalidatePath("/consulta");
  revalidatePath("/backoffice");
  revalidatePath(`/backoffice/${casoId}`);
  return { ok: true, message: "Recontacto programado y notificación enviada." };
}

export async function completarRecontacto(
  formData: FormData,
): Promise<ActualizarCasoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Inicia sesión para registrar el recontacto." };
  }

  const callbackId = String(formData.get("callback_id") ?? "");
  if (!isUuid(callbackId)) {
    return { ok: false, error: "El recordatorio no es válido." };
  }

  const { error } = await supabase.rpc("completar_callback", {
    p_callback_id: callbackId,
  });

  if (error) {
    console.error("Error al completar el recontacto:", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/consulta");
  revalidatePath("/backoffice");
  return { ok: true, message: "Recontacto marcado como realizado." };
}

export async function posponerRecontacto(
  formData: FormData,
): Promise<ActualizarCasoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Inicia sesión para posponer el recontacto." };
  }

  const callbackId = String(formData.get("callback_id") ?? "");
  const minutos = Number(formData.get("minutos") ?? 15);

  if (!isUuid(callbackId)) {
    return { ok: false, error: "El recordatorio no es válido." };
  }
  if (!Number.isFinite(minutos) || minutos < 5 || minutos > 1440) {
    return { ok: false, error: "El tiempo de posposición no es válido." };
  }

  const { error } = await supabase.rpc("posponer_callback", {
    p_callback_id: callbackId,
    p_minutos: Math.round(minutos),
  });

  if (error) {
    console.error("Error al posponer el recontacto:", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/consulta");
  return { ok: true, message: `Recontacto pospuesto ${Math.round(minutos)} minutos.` };
}
