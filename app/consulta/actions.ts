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
