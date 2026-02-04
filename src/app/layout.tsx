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
  icons: {
    // Usamos v=5 para obligar al navegador a descartar la versión con fondo blanco
    icon: [
      { url: "/logo.png?v=5", type: "image/png" }
    ],
    shortcut: "/logo.png?v=5",
    apple: "/logo.png?v=5",
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
        <meta name="theme-color" content="#ea580c" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Agregamos sizes="any" para que el navegador no intente ajustar el PNG a un cuadrado sólido */}
        <link rel="icon" href="/logo.png?v=5" type="image/png" sizes="any" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}