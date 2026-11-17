"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import type { ActualizarPerfilState, Usuario } from "@/lib/types";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const PUBLIC_AVATAR_PATH = "/storage/v1/object/public/avatars/";

function rutaAvatarDesdeUrl(url: string | null): string | null {
  if (!url) return null;
  const index = url.indexOf(PUBLIC_AVATAR_PATH);
  if (index === -1) return null;
  return decodeURIComponent(
    url.slice(index + PUBLIC_AVATAR_PATH.length).split("?")[0],
  );
}

export async function actualizarPerfil(
  formData: FormData,
): Promise<ActualizarPerfilState> {
  const nombre = String(formData.get("nombre_completo") ?? "").trim();
  const avatar = formData.get("avatar");

  if (!nombre) {
    return { ok: false, error: "El nombre completo es obligatorio." };
  }

  if (nombre.length > 160) {
    return {
      ok: false,
      error: "El nombre completo no puede superar los 160 caracteres.",
    };
  }

  const { user, perfil, supabase } = await getSessionContext();

  if (!user || !perfil) {
    return {
      ok: false,
      error: "Tu sesión expiró. Inicia sesión nuevamente para continuar.",
    };
  }

  if (perfil.rol !== "backoffice") {
    return {
      ok: false,
      error: "Solo los usuarios de Backoffice pueden actualizar su perfil.",
    };
  }

  let nuevoAvatarUrl: string | null = null;
  let nuevoAvatarPath: string | null = null;
  const tieneNuevoAvatar = avatar instanceof File && avatar.size > 0;

  if (tieneNuevoAvatar) {
    const extension = AVATAR_MIME_EXT[avatar.type];

    if (!extension) {
      return {
        ok: false,
        error: "La imagen debe ser PNG, JPG o WebP.",
      };
    }

    if (avatar.size > MAX_AVATAR_BYTES) {
      return {
        ok: false,
        error: "La imagen no puede superar los 2 MB.",
      };
    }

    nuevoAvatarPath = `${user.id}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(nuevoAvatarPath, avatar, {
        cacheControl: "3600",
        contentType: avatar.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        ok: false,
        error: "No fue posible subir la imagen. Inténtalo nuevamente.",
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(nuevoAvatarPath);

    nuevoAvatarUrl = publicUrlData.publicUrl;
  }

  const { data, error: rpcError } = await supabase.rpc(
    "actualizar_perfil_backoffice",
    {
      p_nombre_completo: nombre,
      p_avatar_url: nuevoAvatarUrl,
    },
  );

  if (rpcError) {
    if (nuevoAvatarPath) {
      await supabase.storage.from("avatars").remove([nuevoAvatarPath]);
    }

    return {
      ok: false,
      error:
        "No fue posible guardar el perfil. Verifica tus permisos e inténtalo nuevamente.",
    };
  }

  const anteriorPath = rutaAvatarDesdeUrl(perfil.avatar_url);

  if (nuevoAvatarPath && anteriorPath && anteriorPath !== nuevoAvatarPath) {
    await supabase.storage.from("avatars").remove([anteriorPath]);
  }

  const actualizado = data as Usuario | null;

  revalidatePath("/backoffice");
  revalidatePath("/escalamiento");
  revalidatePath("/consulta");

  return {
    ok: true,
    message: "Perfil actualizado correctamente.",
    nombre_completo: actualizado?.nombre_completo ?? nombre,
    avatar_url: actualizado?.avatar_url ?? nuevoAvatarUrl ?? perfil.avatar_url,
  };
}
