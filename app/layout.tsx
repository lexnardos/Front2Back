import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "F2B | Front2Back",
    template: "%s | F2B",
  },
  description:
    "Gestión, trazabilidad y consulta de escalamientos operativos entre Frontoffice y Backoffice.",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
