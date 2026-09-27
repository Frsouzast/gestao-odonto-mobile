"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, useAuth } from "@/lib/auth-store";
import { brl, pct, hoje, mesAtual, dataBR, nomeMes } from "@/lib/utils";
import {
  Wallet, CalendarDays, Calculator, Settings2, TrendingUp, TrendingDown,
  Clock, AlertTriangle, ArrowRight, Activity, Users, Receipt, CheckCircle2,
  Stethoscope, type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type AbaId = "inicio" | "custos" | "procedimentos" | "agenda" | "financeiro" | "usuarios";

interface ResumoFinanceiro {
  receitas: number;
  despesas: number;
  resultado: number;
  aReceber: number;
  aPagar: number;
  inadimplencia: number;
  receitaPorOrigem: { origem: string; valor: number }[];
}

interface ResumoCustos {
  custoFixoTotal: number;
  depreciacaoMensalTotal: number;
  horasEfetivas: number;
  custoFixoPorHora: number;
  custoFixoPorMinuto: number;
}

interface Agendamento {
  id: string;
  nome: string;
  hora: string | null;
  exame: string | null;
  status: string;
}

interface Procedimento {
  id: string;
  nome: string;
  tempoMinutos: number;
  precoFinal: number | null;
}

interface InicioTabProps {
  onNavegar: (aba: AbaId) => void;
}

export function InicioTab({ onNavegar }: InicioTabProps) {
  const usuario = useAuth((s) => s.usuario);
  const mes = mesAtual();
  const dataHoje = hoje();

  const financeiroQ = useQuery<ResumoFinanceiro>({
    queryKey: ["financeiro", "resumo", mes],
    queryFn: () => apiFetch(`/api/financeiro/resumo?mes=${mes}`),
    retry: 0,
  });

  const custosQ = useQuery<ResumoCustos>({
    queryKey: ["resumo"],
    queryFn: () => apiFetch(`/api/resumo`),
    retry: 0,
  });

  const agendamentosQ = useQuery<Agendamento[]>({
    queryKey: ["agendamentos", dataHoje],
    queryFn: () => apiFetch(`/api/agendamentos?data=${dataHoje}`),
    retry: 0,
  });

  const procedimentosQ = useQuery<Procedimento[]>({
    queryKey: ["procedimentos"],
    queryFn: () => apiFetch(`/api/procedimentos`),
    retry: 0,
  });

  const papel = usuario?.papel;
  const podeEditar = papel === "dono" || papel === "financeiro";
  const saudacao = usarSaudacao();
  const primeiroNome = usuario?.nome.split(" ")[0] || "";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero / Saudação */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--accent-app)] to-[var(--accent-app-hover)] text-white p-5 sm:p-6 shadow-sm"
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-black/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70 mb-1">
              {saudacao}, {primeiroNome}
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold mb-1">
              Visão geral da clínica
            </h1>
            <p className="text-sm text-white/80">
              {nomeMes(mes)} · {dataBR(dataHoje)}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2">
            <Stethoscope size={18} />
            <span className="text-xs font-medium uppercase tracking-wide">{usuario?.clinica.nome}</span>
          </div>
        </div>
      </motion.div>

      {/* KPIs principais — Financeiro do mês */}
      {podeEditar && (
        <section>
          <SectionHeader
            icon={Wallet}
            title="Financeiro do mês"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavegar("financeiro")}
                className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
              >
                Ver detalhes <ArrowRight size={14} className="ml-1" />
              </Button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              label="Receitas"
              value={financeiroQ.data?.receitas}
              loading={financeiroQ.isLoading}
              icon={TrendingUp}
              accent="positive"
            />
            <KpiCard
              label="Despesas pagas"
              value={financeiroQ.data?.despesas}
              loading={financeiroQ.isLoading}
              icon={TrendingDown}
              accent="negative"
            />
            <KpiCard
              label="Resultado"
              value={financeiroQ.data?.resultado}
              loading={financeiroQ.isLoading}
              icon={Activity}
              accent={Number(financeiroQ.data?.resultado) >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              label="A receber"
              value={financeiroQ.data?.aReceber}
              loading={financeiroQ.isLoading}
              icon={Receipt}
            />
            <KpiCard
              label="A pagar"
              value={financeiroQ.data?.aPagar}
              loading={financeiroQ.isLoading}
              icon={Clock}
            />
            <KpiCard
              label="Inadimplência"
              value={financeiroQ.data?.inadimplencia}
              loading={financeiroQ.isLoading}
              icon={AlertTriangle}
              accent={Number(financeiroQ.data?.inadimplencia) > 0 ? "warning" : undefined}
            />
          </div>
        </section>
      )}

      {/* Grid 2 colunas: Agenda de hoje + Custos/Procedimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda de hoje */}
        <section className="lg:col-span-2">
          <SectionHeader
            icon={CalendarDays}
            title="Agenda de hoje"
            subtitle={
              agendamentosQ.data
                ? `${agendamentosQ.data.length} agendamento(s)`
                : undefined
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavegar("agenda")}
                className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
              >
                Abrir agenda <ArrowRight size={14} className="ml-1" />
              </Button>
            }
          />
          <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl overflow-hidden">
            {agendamentosQ.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-[var(--bg-app-alt-strong)]" />
                ))}
              </div>
            ) : agendamentosQ.data && agendamentosQ.data.length > 0 ? (
              <ul className="divide-y divide-[var(--border-app-subtle)] max-h-72 overflow-y-auto scroll-thin">
                {agendamentosQ.data.slice(0, 8).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-app-alt-strong)] transition-colors"
                  >
                    <div className="w-12 text-center shrink-0">
                      <div className="text-xs font-mono font-semibold text-[var(--accent-app-text)]">
                        {a.hora || "—"}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--text-app)] truncate">
                        {a.nome}
                      </div>
                      <div className="text-xs text-[var(--text-app-muted)] truncate">
                        {a.exame || "Exame não informado"}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-10 text-center">
                <CalendarDays className="mx-auto mb-2 text-[var(--text-app-faint)]" size={28} />
                <p className="text-sm text-[var(--text-app-muted)]">
                  Nenhum agendamento para hoje.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavegar("agenda")}
                  className="mt-3 text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)]"
                >
                  Adicionar na agenda
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Painel direito: Custos + Procedimentos resumidos */}
        <section className="space-y-4">
          {/* Custo por minuto */}
          <div>
            <SectionHeader
              icon={Settings2}
              title="Custo fixo"
              compact
            />
            <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4">
              {custosQ.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full bg-[var(--bg-app-alt-strong)]" />
                  <Skeleton className="h-4 w-2/3 bg-[var(--bg-app-alt-strong)]" />
                </div>
              ) : custosQ.data ? (
                <div className="space-y-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-app-faint)] mb-0.5">
                      Custo fixo / minuto
                    </div>
                    <div className="text-2xl font-mono tabular-nums font-semibold text-[var(--accent-app-text)]">
                      {brl(custosQ.data.custoFixoPorMinuto)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-app-subtle)]">
                    <div>
                      <div className="text-[10px] uppercase text-[var(--text-app-faint)]">Total/mês</div>
                      <div className="text-sm font-mono tabular-nums text-[var(--text-app)]">
                        {brl(custosQ.data.custoFixoTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-[var(--text-app-faint)]">Horas/mês</div>
                      <div className="text-sm font-mono tabular-nums text-[var(--text-app)]">
                        {custosQ.data.horasEfetivas.toFixed(0)}h
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <AlertTriangle className="mx-auto mb-1.5 text-[var(--warning-app)]" size={20} />
                  <p className="text-xs text-[var(--text-app-muted)] mb-2">
                    Capacidade produtiva não configurada.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavegar("custos")}
                    className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs"
                  >
                    Configurar <ArrowRight size={12} className="ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Procedimentos cadastrados */}
          <div>
            <SectionHeader
              icon={Calculator}
              title="Procedimentos"
              compact
            />
            <div className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4">
              {procedimentosQ.isLoading ? (
                <Skeleton className="h-16 w-full bg-[var(--bg-app-alt-strong)]" />
              ) : procedimentosQ.data ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-mono tabular-nums font-semibold text-[var(--text-app)]">
                      {procedimentosQ.data.length}
                    </span>
                    <span className="text-xs text-[var(--text-app-muted)]">
                      {procedimentosQ.data.length === 1 ? "procedimento" : "procedimentos"}
                    </span>
                  </div>
                  {procedimentosQ.data.length > 0 ? (
                    <div className="text-[11px] text-[var(--text-app-muted)]">
                      {procedimentosQ.data.filter((p) => p.precoFinal).length} com preço definido ·{" "}
                      {procedimentosQ.data.filter((p) => !p.precoFinal).length} pendentes
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavegar("procedimentos")}
                      className="text-[var(--accent-app-text)] hover:bg-[var(--accent-app-soft-bg)] text-xs p-0 h-auto"
                    >
                      Criar primeiro procedimento <ArrowRight size={12} className="ml-1" />
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* Atalhos rápidos */}
      <section>
        <SectionHeader icon={Activity} title="Atalhos rápidos" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AtalhoCard
            icon={CalendarDays}
            label="Nova agenda"
            description="Agendar paciente"
            onClick={() => onNavegar("agenda")}
          />
          <AtalhoCard
            icon={Calculator}
            label="Novo procedimento"
            description="Calcular preço"
            onClick={() => onNavegar("procedimentos")}
          />
          {podeEditar && (
            <>
              <AtalhoCard
                icon={Wallet}
                label="Lançar conta"
                description="Contas a receber/pagar"
                onClick={() => onNavegar("financeiro")}
              />
              <AtalhoCard
                icon={Settings2}
                label="Custos & capacidade"
                description="Configurar clínica"
                onClick={() => onNavegar("custos")}
              />
            </>
          )}
          {papel === "dono" && (
            <AtalhoCard
              icon={Users}
              label="Convidar usuário"
              description="Adicionar equipe"
              onClick={() => onNavegar("usuarios")}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${compact ? "mb-1.5" : "mb-3"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={compact ? 14 : 16} className="text-[var(--text-app-muted)] shrink-0" />
        <h2 className={`${compact ? "text-xs" : "text-sm"} font-semibold text-[var(--text-app)] truncate`}>
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-[var(--text-app-faint)]">· {subtitle}</span>
        )}
      </div>
      {action}
    </div>
  );
}

function KpiCard({
  label,
  value,
  loading,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | undefined;
  loading?: boolean;
  icon: LucideIcon;
  accent?: "positive" | "negative" | "warning";
}) {
  const colorClass =
    accent === "positive"
      ? "text-[var(--accent-app-text)]"
      : accent === "negative"
      ? "text-[var(--danger-app)]"
      : accent === "warning"
      ? "text-[var(--warning-app)]"
      : "text-[var(--text-app)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-3 sm:p-4 hover:border-[var(--border-app-strong)] hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-app-faint)] font-medium">
          {label}
        </span>
        <Icon size={13} className="text-[var(--text-app-faint)]" />
      </div>
      {loading ? (
        <Skeleton className="h-6 w-20 bg-[var(--bg-app-alt-strong)]" />
      ) : (
        <div className={`text-lg sm:text-xl font-mono tabular-nums font-semibold ${colorClass}`}>
          {brl(value ?? 0)}
        </div>
      )}
    </motion.div>
  );
}

function AtalhoCard({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-[var(--surface-app)] border border-[var(--border-app)] rounded-xl p-4 text-left hover:border-[var(--accent-app-soft-border)] hover:bg-[var(--accent-app-soft-bg)] hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--bg-app-alt-strong)] group-hover:bg-[var(--accent-app)] group-hover:text-white text-[var(--text-app-muted)] grid place-items-center transition-colors shrink-0">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--text-app)] group-hover:text-[var(--accent-app-text)] transition-colors">
            {label}
          </div>
          <div className="text-[11px] text-[var(--text-app-muted)] truncate">
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    aguardando: { label: "Aguardando", className: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]" },
    atendido: { label: "Atendido", className: "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]" },
    faltou: { label: "Faltou", className: "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]" },
    desmarcou: { label: "Desmarcou", className: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]" },
    remarcado: { label: "Remarcado", className: "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]" },
  };
  const s = map[status] || { label: status, className: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]" };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  );
}

function usarSaudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}
