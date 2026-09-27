"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import {
  Stethoscope,
  Sun,
  Moon,
  Settings2,
  LogOut,
  Users,
  Calculator,
  CalendarDays,
  LayoutDashboard,
  Wallet,
} from "lucide-react";
import { CORES_DISPONIVEIS, setCorDestaque } from "./theme-applier";
import { toast } from "sonner";
import { CustosCapacidadeTab } from "@/components/tabs/custos-capacidade-tab";
import { ProcedimentosTab } from "@/components/tabs/procedimentos-tab";
import { AgendaTab } from "@/components/tabs/agenda-tab";
import { FinanceiroTab } from "@/components/tabs/financeiro-tab";

type AbaId =
  | "dashboard"
  | "custos"
  | "procedimentos"
  | "agenda"
  | "financeiro";

interface Aba {
  id: AbaId;
  label: string;
  icon: React.ReactNode;
  papeisPermitidos: ("dono" | "financeiro" | "recepcao")[];
}

const ABAS: Aba[] = [
  { id: "custos", label: "Custos & Capacidade", icon: <Settings2 size={16} />, papeisPermitidos: ["dono", "financeiro"] },
  { id: "procedimentos", label: "Procedimentos", icon: <Calculator size={16} />, papeisPermitidos: ["dono", "financeiro", "recepcao"] },
  { id: "agenda", label: "Agenda", icon: <CalendarDays size={16} />, papeisPermitidos: ["dono", "financeiro", "recepcao"] },
  { id: "financeiro", label: "Financeiro", icon: <Wallet size={16} />, papeisPermitidos: ["dono", "financeiro"] },
];

export function AppShell() {
  const usuario = useAuth((s) => s.usuario);
  const limpar = useAuth((s) => s.limpar);
  const { theme, setTheme } = useTheme();
  const [aba, setAba] = useState<AbaId>("custos");

  if (!usuario) return null;

  const abasVisiveis = ABAS.filter((a) =>
    a.papeisPermitidos.includes(usuario.papel)
  );

  // Se a aba atual não for permitida pro papel, volta pra primeira permitida
  const abaAtualEhPermitida = abasVisiveis.some((a) => a.id === aba);
  const abaEfetiva = abaAtualEhPermitida ? aba : abasVisiveis[0].id;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="sticky top-0 z-30 bg-[var(--surface-app)] border-b border-[var(--border-app)]">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-app)] text-white grid place-items-center shrink-0">
              <Stethoscope size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text-app)] truncate">
                {usuario.clinica.nome}
              </div>
              <div className="text-[11px] text-[var(--text-app-muted)] truncate">
                {usuario.nome} · {papelLabel(usuario.papel)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--text-app-muted)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Alternar tema claro/escuro"
            >
              {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--text-app-muted)] hover:text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
                  title="Cor de destaque"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-1 ring-[var(--border-app-strong)]"
                    style={{ background: `var(--accent-app)` }}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[var(--surface-app)] border-[var(--border-app)]">
                <DropdownMenuLabel className="text-[var(--text-app-muted)] text-xs">
                  Cor de destaque
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--border-app)]" />
                {CORES_DISPONIVEIS.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => {
                      setCorDestaque(c.id);
                      toast.success(`Cor: ${c.nome}`);
                    }}
                    className="text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)]"
                  >
                    <span
                      className="w-4 h-4 rounded-full mr-2 ring-1 ring-[var(--border-app-strong)]"
                      style={{ background: c.swatch }}
                    />
                    {c.nome}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)] gap-2"
                >
                  <Users size={15} />
                  <span className="hidden sm:inline text-xs">{usuario.nome.split(" ")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[var(--surface-app)] border-[var(--border-app)]">
                <DropdownMenuLabel className="text-[var(--text-app-muted)] text-xs font-normal">
                  {usuario.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--border-app)]" />
                <DropdownMenuItem
                  onClick={() => {
                    limpar();
                    toast.success("Sessão encerrada");
                  }}
                  className="text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)] cursor-pointer"
                >
                  <LogOut size={14} className="mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs de navegação */}
        <nav className="px-2 sm:px-4 flex gap-0.5 overflow-x-auto scroll-thin border-t border-[var(--border-app-subtle)]">
          {abasVisiveis.map((a) => {
            const ativa = abaEfetiva === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 sm:px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                  ativa
                    ? "border-[var(--accent-app)] text-[var(--accent-app-text)]"
                    : "border-transparent text-[var(--text-app-muted)] hover:text-[var(--text-app)]"
                }`}
              >
                {a.icon}
                {a.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden bg-[var(--bg-app)]">
        {abaEfetiva === "custos" && <CustosCapacidadeTab />}
        {abaEfetiva === "procedimentos" && <ProcedimentosTab />}
        {abaEfetiva === "agenda" && <AgendaTab />}
        {abaEfetiva === "financeiro" && <FinanceiroTab />}
      </div>
    </div>
  );
}

function papelLabel(p: "dono" | "financeiro" | "recepcao") {
  return p === "dono" ? "Dono(a)" : p === "financeiro" ? "Financeiro" : "Recepção";
}
