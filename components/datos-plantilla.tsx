import {
  formatearValorCampo,
  getPlantilla,
  type CampoPlantilla,
} from "@/lib/plantillas";
import { cn, formatDateOnly } from "@/lib/utils";

function humanizar(nombre: string): string {
  return nombre
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function valorVisible(campo: CampoPlantilla, value: unknown): string {
  if (campo.type === "date") {
    return formatDateOnly(typeof value === "string" ? value : null);
  }
  if (campo.type === "datetime-local") {
    if (typeof value !== "string" || !value) return "—";
    const [fecha, hora] = value.split("T");
    const fechaFormateada = formatDateOnly(fecha);
    return hora ? `${fechaFormateada} ${hora}` : fechaFormateada;
  }
  return formatearValorCampo(campo, value);
}

export function DatosPlantilla({
  tipologia,
  datos,
}: {
  tipologia: string;
  datos: Record<string, unknown>;
}) {
  const plantilla = getPlantilla(tipologia);
  const campos: CampoPlantilla[] =
    plantilla?.campos ??
    Object.keys(datos).map((nombre) => ({
      name: nombre,
      label: humanizar(nombre),
      type: "text" as const,
    }));

  if (campos.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Este caso no tiene datos de plantilla registrados.
      </p>
    );
  }

  return (
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {campos.map((campo) => (
        <div
          key={campo.name}
          className={cn(
            "min-w-0",
            campo.type === "textarea" && "sm:col-span-2",
          )}
        >
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {campo.label}
          </dt>
          <dd
            className={cn(
              "mt-1 text-sm text-slate-900",
              campo.type === "textarea"
                ? "whitespace-pre-wrap leading-6"
                : "break-words font-medium",
            )}
          >
            {valorVisible(campo, datos[campo.name])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
