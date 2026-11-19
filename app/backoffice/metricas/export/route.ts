import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth";
import {
  cargarCasosParaMetricas,
  filtrarCasos,
  parsearFiltros,
  casosACsv,
} from "@/lib/metricas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { perfil, supabase } = await getSessionContext();

  if (!perfil || perfil.rol !== "backoffice") {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 },
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filtros = parsearFiltros(params);
  const { casos } = await cargarCasosParaMetricas(supabase);
  const csv = casosACsv(filtrarCasos(casos, filtros));
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="f2b-metricas-${fecha}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
