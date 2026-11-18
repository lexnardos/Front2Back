import Link from "next/link";
import { IconBell } from "@/components/icons";
import { NotificationCenter } from "@/components/notification-center";
import { getSessionContext } from "@/lib/auth";
import type { Notificacion, RolUsuario } from "@/lib/types";

interface NotificationBellProps {
  rol?: RolUsuario;
}

export async function NotificationBell({ rol }: NotificationBellProps) {
  const { user, perfil, supabase } = await getSessionContext();

  if (!user) {
    return (
      <Link
        href="/login"
        aria-label="Inicia sesión para ver tus notificaciones"
        title="Inicia sesión para ver tus notificaciones"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        <IconBell className="h-[18px] w-[18px]" />
      </Link>
    );
  }

  let notificaciones: Notificacion[] = [];
  let noLeidas = 0;

  try {
    const [lista, conteo] = await Promise.all([
      supabase
        .from("notificaciones")
        .select(
          "id, caso_id, numero_radicado, tipo, titulo, mensaje, leida, created_at",
        )
        .eq("usuario_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("notificaciones")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", user.id)
        .eq("leida", false),
    ]);

    notificaciones = (lista.data ?? []) as unknown as Notificacion[];
    noLeidas = conteo.count ?? 0;
  } catch {
    notificaciones = [];
    noLeidas = 0;
  }

  return (
    <NotificationCenter
      userId={user.id}
      rol={rol ?? perfil?.rol ?? "agente"}
      notificacionesIniciales={notificaciones}
      noLeidasIniciales={noLeidas}
    />
  );
}
