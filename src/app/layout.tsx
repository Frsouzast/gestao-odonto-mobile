import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestão Odonto-Radiológica",
  description:
    "Calculadora de custo e precificação para clínicas de radiologia odontológica — com módulo financeiro completo (convênios, glosas, DRE, lotes, conciliação).",
  keywords: [
    "radiologia odontológica",
    "precificação clínica",
    "gestão financeira",
    "DRE clínica",
    "convênios odontologia",
  ],
  authors: [{ name: "Frsouzast" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
        <Sonner position="top-right" />
      </body>
    </html>
  );
}
