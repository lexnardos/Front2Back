export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return dateFormatter.format(new Date(Date.UTC(year, month - 1, day, 12)));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

export function sanitizeSearchTerm(value: string): string {
  return value
    .replace(/[(),%"'\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function truncate(value: string, length = 70): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function formatearDuracion(milisegundos: number | null | undefined): string {
  if (milisegundos === null || milisegundos === undefined || !Number.isFinite(milisegundos)) {
    return "—";
  }
  const total = Math.max(0, Math.floor(milisegundos / 60000));
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  if (horas >= 24) {
    const dias = Math.floor(horas / 24);
    return `${dias}d ${horas % 24}h ${String(minutos).padStart(2, "0")}m`;
  }
  return `${horas}h ${String(minutos).padStart(2, "0")}m`;
}

export function normalizarBusqueda(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);
}

export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const texto = String(value).replace(/\r?\n/g, " ").trim();
  return `"${texto.replace(/"/g, '""')}"`;
}

export function valorPlantilla(
  datos: Record<string, unknown> | null | undefined,
  ...claves: string[]
): string {
  if (!datos) return "";
  for (const clave of claves) {
    const valor = datos[clave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
    if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  }
  return "";
}

export function evidenciasDe(datos: Record<string, unknown> | null | undefined): unknown[] {
  const valor = datos?.evidencias;
  return Array.isArray(valor) ? valor : [];
}
