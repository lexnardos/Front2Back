"use client";

import { createClient } from "@/lib/supabase/client";
import type { Evidencia } from "@/lib/types";

export const BUCKET_EVIDENCIAS = "evidencias-casos";
const TAMANO_MAXIMO = 10 * 1024 * 1024;
const MIME_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
];

export function validarImagen(file: File): string | null {
  if (!MIME_PERMITIDOS.includes(file.type)) {
    return "Solo se permiten imágenes PNG, JPG, WEBP, GIF o AVIF.";
  }
  if (file.size > TAMANO_MAXIMO) {
    return "Cada imagen debe pesar menos de 10 MB.";
  }
  return null;
}

function extension(file: File): string {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith(".jpg") || nombre.endsWith(".jpeg")) return "jpg";
  if (nombre.endsWith(".png")) return "png";
  if (nombre.endsWith(".webp")) return "webp";
  if (nombre.endsWith(".gif")) return "gif";
  if (nombre.endsWith(".avif")) return "avif";
  return "img";
}

export async function subirEvidencia(
  radicado: string,
  file: File,
): Promise<Evidencia> {
  const error = validarImagen(file);
  if (error) throw new Error(error);

  const supabase = createClient();
  const carpeta = encodeURIComponent(radicado.trim().toUpperCase());
  const nombreArchivo = `${crypto.randomUUID()}.${extension(file)}`;
  const path = `${carpeta}/${nombreArchivo}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(`No fue posible subir "${file.name}": ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .getPublicUrl(path);

  return {
    url: data.publicUrl,
    path,
    nombre: file.name,
    tipo: file.type,
    tamano: file.size,
    subida_en: new Date().toISOString(),
  };
}

export async function eliminarEvidencia(evidencia: Evidencia): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .remove([evidencia.path]);
  if (error) throw new Error(error.message);
}
