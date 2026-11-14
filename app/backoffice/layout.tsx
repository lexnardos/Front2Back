import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceHeader } from "@/components/workspace-header";
import { getSessionContext } from "@/lib/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, perfil } = await getSessionContext();

  if (!user) {
    redirect("/login?next=/backoffice");
  }

  if (!perfil) {
    redirect("/login?error=sin-perfil");
  }

  if (perfil.rol !== "backoffice") {
    redirect("/escalamiento");
  }

  return (
    <div className="min-h-screen">
      <WorkspaceHeader
        nombre={perfil.nombre_completo}
        rol={perfil.rol}
        active="backoffice"
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}
