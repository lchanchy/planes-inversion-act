import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Restauracion Admin",
  description: "Web administrativa para proyectos de restauracion ecologica"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
