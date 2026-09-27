"use client";

import { useAuth } from "@/lib/auth-store";
import { LoginScreen } from "@/components/auth/login-screen";
import { AppShell } from "@/components/app/app-shell";
import { ThemeApplier } from "@/components/app/theme-applier";

export default function Home() {
  const usuario = useAuth((s) => s.usuario);

  return (
    <>
      <ThemeApplier />
      <main className="min-h-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-app)]">
        {usuario ? <AppShell /> : <LoginScreen />}
      </main>
    </>
  );
}
