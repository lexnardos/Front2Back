export const ESTADOS_CASO = [
  "Pendiente",
  "En Proceso",
  "Completado",
  "Rechazado",
] as const;

export type EstadoCaso = (typeof ESTADOS_CASO)[number];

export const ROLES_USUARIO = ["backoffice", "agente"] as const;

export type RolUsuario = (typeof ROLES_USUARIO)[number];

export interface Usuario {
  id: string;
  nombre_completo: string;
  correo: string;
  rol: RolUsuario;
  created_at: string;
}

export interface CasoEscalamiento {
  id: string;
  numero_radicado: string;
  tipologia: string;
  datos_plantilla: Record<string, unknown>;
  estado: EstadoCaso;
  paso_actual: string;
  creado_por: string;
  creado_por_id: string | null;
  asignado_a: string | null;
  created_at: string;
  updated_at: string;
  asignado?: Pick<Usuario, "id" | "nombre_completo" | "correo"> | null;
}

export interface HistorialMovimiento {
  id: string;
  caso_id: string;
  estado_anterior: EstadoCaso | null;
  estado_nuevo: EstadoCaso;
  paso_registrado: string;
  comentario: string | null;
  usuario_id: string | null;
  fecha_movimiento: string;
  usuario?: Pick<Usuario, "id" | "nombre_completo" | "correo"> | null;
}

export interface CasoConsulta {
  id: string;
  numero_radicado: string;
  tipologia: string;
  estado: EstadoCaso;
  paso_actual: string;
  creado_por: string;
  created_at: string;
  updated_at: string;
}

export interface MovimientoConsulta {
  id: string;
  estado_anterior: EstadoCaso | null;
  estado_nuevo: EstadoCaso;
  paso_registrado: string;
  comentario: string | null;
  fecha_movimiento: string;
  usuario: string;
}

export interface ConsultaRadicado {
  caso: CasoConsulta;
  historial: MovimientoConsulta[];
}

export interface CrearCasoState {
  ok: boolean;
  error?: string;
  radicado?: string;
  fieldErrors?: Record<string, string>;
}

export interface ActualizarCasoState {
  ok: boolean;
  error?: string;
  message?: string;
}
