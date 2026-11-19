"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPlantilla } from "@/lib/plantillas";
import type {
  CasoDuplicado,
  CasoEscalamiento,
  ConsultaRadicado,
  CrearCasoState,
} from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function construirDatos(
  formData: FormData,
  tipologia: string,
): {
  datos: Record<string, string>;
  fieldErrors: Record<string, string>;
} {
  const plantilla = getPlantilla(tipologia);
  const fieldErrors: Record<string, string> = {};
  const datos: Record<string, string> = {};

  if (!plantilla) {
    return {
      datos,
      fieldErrors: { tipologia: "Selecciona una tipología válida." },
    };
  }

  for (const campo of plantilla.campos) {
    const raw = formData.get(`campo_${campo.name}`);
    const value = typeof raw === "string" ? raw.trim() : "";
    const maxLength = campo.maxLength ?? 1500;

    if (!value) {
      if (campo.required) {
        fieldErrors[campo.name] = "Este campo es obligatorio.";
      }
      continue;
    }

    if (value.length > maxLength) {
      fieldErrors[campo.name] = `Máximo ${maxLength} caracteres.`;
      continue;
    }

    if (campo.type === "email" && !EMAIL_PATTERN.test(value)) {
      fieldErrors[campo.name] = "Ingresa un correo válido.";
      continue;
    }

    if (
      campo.type === "number" &&
      (value.length > 30 || !Number.isFinite(Number(value)))
    ) {
      fieldErrors[campo.name] = "Ingresa un valor numérico válido.";
      continue;
    }

    if (
      campo.type === "select" &&
      campo.options &&
      !campo.options.some((option) => option.value === value)
    ) {
      fieldErrors[campo.name] = "Selecciona una opción válida.";
      continue;
    }

    datos[campo.name] = value;
  }

  return { datos, fieldErrors };
}

export async function crearCaso(
  formData: FormData,
): Promise<CrearCasoState> {
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
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil) {
    return {
      ok: false,
      error:
        "Tu usuario no tiene perfil en F2B. Contacta al administrador del sistema.",
    };
  }

  const tipologia = String(formData.get("tipologia") ?? "").trim();
  if (!tipologia) {
    return {
      ok: false,
      error: "Selecciona una tipología para continuar.",
      fieldErrors: { tipologia: "La tipología es obligatoria." },
    };
  }

  const { datos, fieldErrors } = construirDatos(formData, tipologia);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Revisa los campos marcados antes de radicar el caso.",
      fieldErrors,
    };
  }

  const { data, error } = await supabase.rpc("crear_caso_escalamiento", {
    p_tipologia: tipologia,
    p_datos_plantilla: datos,
    p_paso_actual: "Radicado",
  });

  if (error) {
    console.error("Error al crear el escalamiento:", error.message);
    return {
      ok: false,
      error:
        process.env.NODE_ENV === "production"
          ? "No fue posible crear el escalamiento. Inténtalo nuevamente."
          : error.message,
    };
  }

  const raw = data as unknown as CasoEscalamiento | CasoEscalamiento[] | null;
  const caso = Array.isArray(raw) ? raw[0] : raw;

  if (!caso?.numero_radicado) {
    return {
      ok: false,
      error: "El caso se creó, pero no fue posible obtener el radicado.",
    };
  }

  revalidatePath("/backoffice");
  revalidatePath("/consulta");

  return {
    ok: true,
    radicado: caso.numero_radicado,
    slaDeadline: caso.sla_deadline ?? undefined,
  };
}

export async function buscarDuplicados(
  valor: string,
): Promise<CasoDuplicado[]> {
  const normalizado = valor.trim();
  if (normalizado.replace(/[^0-9A-Za-z]/g, "").length < 4) {
    return [];
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase.rpc("buscar_casos_duplicados", {
    p_valor: normalizado,
    p_excluir_id: null,
  });

  if (error) {
    console.error("Error al buscar duplicados:", error.message);
    return [];
  }

  return (data ?? []) as unknown as CasoDuplicado[];
}

export async function obtenerDetalleDuplicado(
  radicado: string,
): Promise<ConsultaRadicado | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !radicado.trim()) return null;

  const { data, error } = await supabase.rpc("consultar_radicado", {
    p_radicado: radicado.trim(),
  });

  if (error) {
    console.error("Error al consultar el caso duplicado:", error.message);
    return null;
  }

  const raw = data as unknown as ConsultaRadicado | null;
  return raw && raw.caso ? raw : null;
}
