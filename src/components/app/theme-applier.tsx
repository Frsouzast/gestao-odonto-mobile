"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Lê a preferência de cor de destaque (teal/azul/roxo) do localStorage e
 * aplica via `data-accent` no <html>. O claro/escuro é controlado pelo
 * next-themes (classe `.dark`).
 */
export function ThemeApplier() {
  const { theme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    try {
      const cor = localStorage.getItem("corDestaque") || "teal";
      root.dataset.accent = cor;
    } catch {
      root.dataset.accent = "teal";
    }
  }, [theme]);

  return null;
}

export const CORES_DISPONIVEIS = [
  { id: "teal", swatch: "#0f766e", nome: "Teal" },
  { id: "blue", swatch: "#1d4ed8", nome: "Azul" },
  { id: "purple", swatch: "#7e22ce", nome: "Roxo" },
] as const;

export function setCorDestaque(cor: string) {
  try {
    localStorage.setItem("corDestaque", cor);
  } catch {}
  document.documentElement.dataset.accent = cor;
}
