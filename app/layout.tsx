import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BAC — Mi Expediente LOPDP",
  description: "Portal de cumplimiento LOPDP para clientes BAC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white antialiased">{children}</body>
    </html>
  );
}
