"use client";

import Link from "next/link";
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  IconArrowRight,
  IconBell,
  IconCheck,
  IconInbox,
  IconTicket,
  IconX,
} from "@/components/icons";
import {
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
} from "@/app/notificaciones/actions";
import type { Notificacion, RolUsuario } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface NotificationCenterProps {
  userId: string;
  rol: RolUsuario;
  notificacionesIniciales: Notificacion[];
  noLeidasIniciales: number;
}

interface State {
  items: Notificacion[];
  unread: number;
}

type Action =
  | { type: "insert"; item: Notificacion }
  | { type: "update"; item: Notificacion }
  | { type: "marcar-uno"; id: string }
  | { type: "marcar-todas" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "insert": {
      if (state.items.some((item) => item.id === action.item.id)) return state;
      return {
        items: [action.item, ...state.items].slice(0, 50),
        unread: state.unread + (action.item.leida ? 0 : 1),
      };
    }
    case "update": {
      const anterior = state.items.find((item) => item.id === action.item.id);
      if (!anterior) return state;
      if (anterior.leida === action.item.leida) return state;
      return {
        items: state.items.map((item) =>
          item.id === action.item.id ? action.item : item,
        ),
        unread: Math.max(
          0,
          state.unread + (action.item.leida ? -1 : 1),
        ),
      };
    }
    case "marcar-uno": {
      const anterior = state.items.find((item) => item.id === action.id);
      if (!anterior || anterior.leida) return state;
      return {
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, leida: true } : item,
        ),
        unread: Math.max(0, state.unread - 1),
      };
    }
    case "marcar-todas": {
      if (state.unread === 0) return state;
      return {
        items: state.items.map((item) => ({ ...item, leida: true })),
        unread: 0,
      };
    }
  }
}

function hrefCaso(notificacion: Notificacion, rol: RolUsuario): string {
  if (rol === "backoffice") return `/backoffice/${notificacion.caso_id}`;
  return `/consulta?radicado=${encodeURIComponent(notificacion.numero_radicado)}`;
}

export function NotificationCenter({
  userId,
  rol,
  notificacionesIniciales,
  noLeidasIniciales,
}: NotificationCenterProps) {
  const [state, dispatch] = useReducer(reducer, {
    items: notificacionesIniciales,
    unread: noLeidasIniciales,
  });
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const contenedorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const filtro = `usuario_id=eq.${userId}`;

    const canal = supabase
      .channel(`f2b-notificaciones-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones",
          filter: filtro,
        },
        (payload) => {
          dispatch({ type: "insert", item: payload.new as Notificacion });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notificaciones",
          filter: filtro,
        },
        (payload) => {
          dispatch({ type: "update", item: payload.new as Notificacion });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId]);

  useEffect(() => {
    if (!abierto) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAbierto(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const objetivo = event.target as Node;
      if (
        !contenedorRef.current?.contains(objetivo) &&
        !panelRef.current?.contains(objetivo)
      ) {
        setAbierto(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [abierto]);

  function marcarUno(id: string) {
    dispatch({ type: "marcar-uno", id });
    startTransition(async () => {
      await marcarNotificacionLeida(id);
    });
  }

  function marcarTodas() {
    dispatch({ type: "marcar-todas" });
    startTransition(async () => {
      await marcarTodasNotificacionesLeidas();
    });
  }

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-label={`Notificaciones${state.unread > 0 ? `, ${state.unread} sin leer` : ""}`}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-lg border text-slate-500 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
          abierto
            ? "border-brand-200 bg-brand-50 text-brand-700"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
        )}
      >
        <IconBell className="h-[18px] w-[18px]" />
        {state.unread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
            {state.unread > 99 ? "99+" : state.unread}
          </span>
        ) : null}
      </button>

      {abierto && typeof document !== "undefined"
        ? createPortal(
            <>
              <div
                aria-hidden
                className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[2px] sm:hidden"
                onClick={() => setAbierto(false)}
              />
              <section
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Centro de notificaciones"
                className="animate-fade-up fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-soft sm:inset-auto sm:right-4 sm:top-[4.5rem] sm:h-[min(30rem,calc(100vh-5.5rem))] sm:w-[22rem] sm:rounded-2xl sm:border lg:right-8"
              >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Notificaciones
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {state.unread > 0
                    ? `${state.unread} sin leer`
                    : "Todo al día"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={marcarTodas}
                  disabled={isPending || state.unread === 0}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  <IconCheck className="h-3.5 w-3.5" />
                  Marcar todas
                </button>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar notificaciones"
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:hidden"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              {state.items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                    <IconInbox className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Sin notificaciones
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Aquí verás la radicación de casos y las respuestas del
                      Backoffice en tiempo real.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {state.items.map((notificacion) => (
                    <li key={notificacion.id}>
                      <Link
                        href={hrefCaso(notificacion, rol)}
                        onClick={() => {
                          marcarUno(notificacion.id);
                          setAbierto(false);
                        }}
                        className={cn(
                          "flex gap-3 px-4 py-3.5 transition hover:bg-slate-50",
                          !notificacion.leida && "bg-brand-50/40",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                            notificacion.tipo === "caso_radicado"
                              ? "bg-brand-100 text-brand-700"
                              : "bg-sky-100 text-sky-700",
                          )}
                        >
                          <IconTicket className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "text-xs leading-5",
                                notificacion.leida
                                  ? "font-medium text-slate-600"
                                  : "font-semibold text-slate-900",
                              )}
                            >
                              {notificacion.titulo}
                            </span>
                            {!notificacion.leida ? (
                              <span
                                aria-label="Sin leer"
                                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500"
                              />
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-5 text-slate-500">
                            {notificacion.mensaje}
                          </span>
                          <span className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                            <span>{formatDateTime(notificacion.created_at)}</span>
                            <span className="inline-flex items-center gap-0.5 font-semibold text-brand-700">
                              Ver caso
                              <IconArrowRight className="h-3 w-3" />
                            </span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </section>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
