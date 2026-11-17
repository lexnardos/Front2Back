"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  IconCamera,
  IconUser,
  IconUserCog,
  IconX,
} from "@/components/icons";
import { actualizarPerfil } from "@/app/perfil/actions";
import type { RolUsuario } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ProfileDialogProps {
  nombre: string;
  correo: string;
  rol: RolUsuario;
  avatarUrl: string | null;
}

export function ProfileDialog({
  nombre,
  correo,
  rol,
  avatarUrl,
}: ProfileDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  function limpiarObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function abrirDialogo() {
    setError(null);
    setPreview(avatarUrl);
    setOpen(true);
  }

  function cerrarDialogo() {
    limpiarObjectUrl();
    setPreview(avatarUrl);
    setError(null);
    setOpen(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    limpiarObjectUrl();

    if (!file) {
      setPreview(avatarUrl);
      return;
    }

    if (!AVATAR_TYPES.includes(file.type)) {
      event.target.value = "";
      setPreview(avatarUrl);
      setError("La imagen debe ser PNG, JPG o WebP.");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      event.target.value = "";
      setPreview(avatarUrl);
      setError("La imagen no puede superar los 2 MB.");
      return;
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreview(url);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        const result = await actualizarPerfil(formData);

        if (!result.ok) {
          setError(result.error ?? "No fue posible actualizar el perfil.");
          return;
        }

        limpiarObjectUrl();
        setPreview(result.avatar_url ?? avatarUrl);
        setOpen(false);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        router.refresh();
      } catch {
        setError(
          "No fue posible conectar con el servidor. Inténtalo nuevamente.",
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirDialogo}
        aria-label="Editar perfil"
        className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:pr-3"
      >
        <Avatar nombre={nombre} src={avatarUrl} />
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="max-w-[150px] truncate text-xs font-semibold text-slate-800">
            {nombre}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {rol}
          </span>
        </span>
        <IconUserCog className="h-4 w-4 text-slate-400 transition group-hover:text-slate-600" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cerrarDialogo();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="perfil-title"
            className="animate-fade-up w-full max-w-lg overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-soft sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="perfil-title"
                  className="text-base font-semibold text-slate-950"
                >
                  Mi perfil
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">{correo}</p>
              </div>
              <button
                type="button"
                onClick={cerrarDialogo}
                aria-label="Cerrar"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
                >
                  {error}
                </div>
              ) : null}

              <div className="flex items-center gap-4">
                <Avatar nombre={nombre} src={preview} size="lg" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Foto de perfil
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    name="avatar"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary mt-2 px-3 py-1.5 text-xs"
                  >
                    <IconCamera className="h-4 w-4 text-slate-500" />
                    Cambiar foto
                  </button>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    PNG, JPG o WebP. Máximo 2 MB.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="nombre_completo" className="field-label">
                  Nombre completo
                </label>
                <input
                  key={nombre}
                  id="nombre_completo"
                  name="nombre_completo"
                  type="text"
                  required
                  maxLength={160}
                  defaultValue={nombre}
                  className="field-input"
                />
              </div>

              <div>
                <label htmlFor="perfil-correo" className="field-label">
                  Correo electrónico
                </label>
                <input
                  id="perfil-correo"
                  type="email"
                  value={correo}
                  readOnly
                  disabled
                  className="field-input bg-slate-50 text-slate-500"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  El correo se administra desde Supabase Auth.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarDialogo}
                  disabled={isPending}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary"
                >
                  {isPending ? (
                    <>
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                        aria-hidden
                      />
                      Guardando...
                    </>
                  ) : (
                    "Guardar cambios"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Avatar({
  src,
  nombre,
  size = "sm",
}: {
  src: string | null;
  nombre: string;
  size?: "sm" | "lg";
}) {
  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 bg-cover bg-center text-slate-500",
        size === "sm" ? "h-8 w-8" : "h-16 w-16",
        src && "ring-1 ring-slate-200",
      )}
      style={src ? { backgroundImage: `url("${src}")` } : undefined}
    >
      {src ? null : size === "sm" ? (
        <IconUser className="h-4 w-4" />
      ) : (
        <span className="text-lg font-semibold text-slate-500">
          {iniciales || <IconUser className="h-6 w-6" />}
        </span>
      )}
    </span>
  );
}
