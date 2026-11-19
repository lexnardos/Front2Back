import { esEstadoFinal, type EstadoCaso } from "@/lib/types";

export type SlaTono =
  | "en-tiempo"
  | "por-vencer"
  | "vencido"
  | "respondido"
  | "pausado";

export interface SlaInfo {
  tono: SlaTono;
  etiqueta: string;
  cronometro: string;
  detalle: string;
  enCurso: boolean;
  progreso: number;
}

interface SlaParams {
  createdAt: string | null | undefined;
  slaDeadline?: string | null;
  primeraRespuestaAt?: string | null;
  estado?: EstadoCaso;
  updatedAt?: string | null;
  pausado?: boolean;
  ahora?: number;
}

const HORA_MS = 60 * 60 * 1000;
const SLA_HORAS = 72;

function milisegundos(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function desglosar(diferencia: number) {
  const total = Math.max(0, Math.floor(diferencia / 1000));
  return {
    horas: Math.floor(total / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  };
}

function formatoCompleto(diferencia: number): string {
  const { horas, minutos, segundos } = desglosar(diferencia);
  return `${horas}h ${minutos}m ${segundos}s`;
}

function formatoRespuesta(diferencia: number): string {
  const { horas, minutos } = desglosar(diferencia);
  return `${horas}h ${minutos}m`;
}

export function calcularSla({
  createdAt,
  slaDeadline,
  primeraRespuestaAt,
  estado,
  updatedAt,
  pausado = false,
  ahora = Date.now(),
}: SlaParams): SlaInfo {
  const inicio = milisegundos(createdAt);
  const limite = milisegundos(slaDeadline) ?? (inicio === null ? null : inicio + SLA_HORAS * HORA_MS);
  const respuesta = milisegundos(primeraRespuestaAt);
  const cerrado = estado ? esEstadoFinal(estado) : false;
  const fin = respuesta ?? (cerrado ? milisegundos(updatedAt) : null);

  if (pausado && !cerrado) {
    return {
      tono: "pausado",
      etiqueta: "En pausa",
      cronometro: "SLA pausado",
      detalle: "El caso fue devuelto al Frontoffice. El contador se reanuda con la subsanación.",
      enCurso: false,
      progreso: 0,
    };
  }

  if (inicio !== null && fin !== null && fin >= inicio) {
    return {
      tono: "respondido",
      etiqueta: respuesta ? "Respondido" : "Cerrado",
      cronometro: respuesta
        ? `Respondido en ${formatoRespuesta(fin - inicio)}`
        : `Cerrado en ${formatoRespuesta(fin - inicio)}`,
      detalle: "El Backoffice registró una respuesta; el contador se detuvo.",
      enCurso: false,
      progreso: 100,
    };
  }

  if (limite === null) {
    return {
      tono: "en-tiempo",
      etiqueta: "SLA",
      cronometro: "Sin fecha límite",
      detalle: "Este caso no tiene una fecha límite registrada.",
      enCurso: false,
      progreso: 0,
    };
  }

  const restante = limite - ahora;
  const inicioEfectivo = inicio ?? ahora - SLA_HORAS * HORA_MS;
  const duracion = limite - inicioEfectivo;
  const progreso =
    duracion > 0
      ? Math.min(100, Math.max(0, ((ahora - inicioEfectivo) / duracion) * 100))
      : 100;

  if (restante <= 0) {
    return {
      tono: "vencido",
      etiqueta: "Vencido",
      cronometro: `Vencido hace ${formatoRespuesta(Math.abs(restante))}`,
      detalle: `El límite de ${SLA_HORAS} horas hábiles ya pasó.`,
      enCurso: true,
      progreso,
    };
  }

  if (restante <= 24 * HORA_MS) {
    return {
      tono: "por-vencer",
      etiqueta: "Por vencer",
      cronometro: `${formatoCompleto(restante)} restantes`,
      detalle: `Límite de respuesta: ${SLA_HORAS} horas desde la radicación.`,
      enCurso: true,
      progreso,
    };
  }

  return {
    tono: "en-tiempo",
    etiqueta: "En tiempo",
    cronometro: `${formatoCompleto(restante)} restantes`,
    detalle: `Límite de respuesta: ${SLA_HORAS} horas desde la radicación.`,
    enCurso: true,
    progreso,
  };
}
