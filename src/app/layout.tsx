import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Club La Cantera", 
  description: "Sistema de Gestión - Club La Cantera",
  manifest: "/manifest.json", 
  // Única adición: Forzamos la carga del logo usando la versión v=4
  icons: {
    icon: "/logo.png?v=4",
    shortcut: "/logo.png?v=4",
    apple: "/logo.png?v=4",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Mantenemos tus metadatos exactos de estética y funcionalidad */}
        <meta name="theme-color" content="#ea580c" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Refuerzo manual con versión para asegurar que el triángulo desaparezca */}
        <link rel="icon" href="/logo.png?v=4" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}