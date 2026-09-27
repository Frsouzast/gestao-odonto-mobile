"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Papel = "dono" | "financeiro" | "recepcao";

export interface SessaoUsuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  clinica: { id: string; nome: string };
}

interface AuthState {
  token: string | null;
  usuario: SessaoUsuario | null;
  setSessao: (token: string, usuario: SessaoUsuario) => void;
  limpar: () => void;
  podeEditar: () => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      setSessao: (token, usuario) => set({ token, usuario }),
      limpar: () => set({ token: null, usuario: null }),
      podeEditar: () => {
        const p = get().usuario?.papel;
        return p === "dono" || p === "financeiro";
      },
    }),
    {
      name: "precificacao-auth",
      storage: createJSONStorage(() => localStorage),
      // só persiste token e usuario — nada de funções
      partialize: (state) => ({
        token: state.token,
        usuario: state.usuario,
      }),
    }
  )
);

/**
 * Helper de fetch que injeta o token JWT e trata erros padrão da API.
 * Retorna o JSON ou lança um Error com a mensagem do backend.
 */
export async function apiFetch<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...opts, headers });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const erro =
      (body && (body.erro || body.error || body.message)) ||
      (typeof body === "string" && body) ||
      `Erro ${res.status}`;
    throw new Error(erro);
  }
  if (res.status === 204) return undefined as T;
  return body as T;
}
