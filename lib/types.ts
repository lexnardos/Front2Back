export const ESTADOS_CASO = [
  "Pendiente",
  "En Proceso",
  "Completado",
  "Rechazado",
  "Devuelto",
] as const;

export type EstadoCaso = (typeof ESTADOS_CASO)[number];

export const ETIQUETAS_ESTADO: Record<EstadoCaso, string> = {
  Pendiente: "Abierto",
  "En Proceso": "En gestión",
  Completado: "Resuelto",
  Rechazado: "Cerrado",
  Devuelto: "Devuelto",
};

export function etiquetaEstado(estado: string): string {
  return ETIQUETAS_ESTADO[estado as EstadoCaso] ?? estado;
}

export function esEstadoFinal(estado: string): boolean {
  return estado === "Completado" || estado === "Rechazado";
}

export const CAUSALES_DEVOLUCION = [
  "Falta pantallazo/evidencia",
  "Número de cuenta o MIN errado",
  "No aplica escalamiento",
  "Datos incompletos en plantilla",
] as const;

export const ROLES_USUARIO = ["backoffice", "agente"] as const;

export type RolUsuario = (typeof ROLES_USUARIO)[number];

export interface Usuario {
  id: string;
  nombre_completo: string;
  correo: string;
  rol: RolUsuario;
  avatar_url: string | null;
  created_at: string;
}

export interface Evidencia {
  url: string;
  path: string;
  nombre: string;
  tipo: string;
  tamano: number;
  subida_en: string;
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
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  locked_at?: string | null;
  created_at: string;
  updated_at: string;
  sla_deadline?: string | null;
  primera_respuesta_at?: string | null;
  sla_pausado_desde?: string | null;
  causal_devolucion?: string | null;
  observacion_devolucion?: string | null;
  cerrado_en?: string | null;
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

export interface RegistroAuditoria {
  id: string;
  fecha_movimiento: string;
  usuario: string;
  rol: "front" | "backoffice" | "sistema" | string;
  accion: string;
  estado_anterior: EstadoCaso | null;
  estado_nuevo: EstadoCaso;
  paso_registrado: string | null;
  comentario: string | null;
  duracion_ms: number | null;
}

export interface CasoConsulta {
  id: string;
  numero_radicado: string;
  tipologia: string;
  estado: EstadoCaso;
  paso_actual: string;
  creado_por: string;
  creado_por_id?: string | null;
  created_at: string;
  updated_at: string;
  sla_deadline?: string | null;
  primera_respuesta_at?: string | null;
  sla_pausado_desde?: string | null;
  causal_devolucion?: string | null;
  observacion_devolucion?: string | null;
  cerrado_en?: string | null;
  datos_plantilla?: Record<string, unknown>;
  evidencias?: Evidencia[];
}

export interface MovimientoConsulta {
  id: string;
  estado_anterior: EstadoCaso | null;
  estado_nuevo: EstadoCaso;
  fecha_movimiento: string;
  usuario: string;
  rol?: string;
  accion?: string;
  paso_registrado?: string | null;
  comentario: string | null;
  duracion_ms?: number | null;
}

export interface ConsultaRadicado {
  caso: CasoConsulta;
  historial: MovimientoConsulta[];
  callbacks?: Callback[];
}

export interface CasoBusqueda {
  id: string;
  numero_radicado: string;
  tipologia: string;
  estado: EstadoCaso;
  creado_por: string;
  created_at: string;
}

export interface CasoDuplicado {
  id: string;
  numero_radicado: string;
  tipologia: string;
  estado: string;
  paso_actual: string;
  creado_por: string;
  created_at: string;
  campo_coincidente?: string;
  valor_coincidente?: string;
}

export interface Callback {
  id: string;
  caso_id?: string;
  programado_para: string;
  estado: "pendiente" | "pospuesto" | "completado" | "cancelado" | string;
  notas: string | null;
  creado_en?: string;
  completado_en?: string | null;
  caso?: { numero_radicado: string; tipologia: string } | null;
}

export interface CrearCasoState {
  ok: boolean;
  error?: string;
  radicado?: string;
  slaDeadline?: string;
  fieldErrors?: Record<string, string>;
}

export const TIPOS_NOTIFICACION = [
  "caso_radicado",
  "caso_actualizado",
  "caso_devuelto",
  "nuevo_escalamiento",
  "subsanacion_reenviada",
  "recordatorio_recontacto",
] as const;

export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

export interface Notificacion {
  id: string;
  usuario_id?: string;
  caso_id: string;
  numero_radicado: string;
  tipo: TipoNotificacion | string;
  target_role?: "backoffice" | "agente" | string | null;
  titulo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

export interface ActualizarCasoState {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface ActualizarPerfilState {
  ok: boolean;
  error?: string;
  message?: string;
  nombre_completo?: string;
  avatar_url?: string | null;
}
