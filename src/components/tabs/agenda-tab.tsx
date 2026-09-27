"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarClock,
  Clock,
  Phone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/auth-store";
import { cn, dataBR } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types — mirror T2-d API contract
// ---------------------------------------------------------------------------
type StatusAgendamento =
  | "aguardando"
  | "atendido"
  | "faltou"
  | "desmarcou"
  | "remarcado";

interface Agendamento {
  id: string;
  clinicaId: string;
  nome: string;
  telefone: string | null;
  exame: string | null;
  plano: boolean;
  particular: boolean;
  data: string;
  hora: string | null;
  status: StatusAgendamento;
  remarcadoParaId: string | null;
  remarcadoParaData: string | null;
  remarcadoParaHora: string | null;
  criadoEm: string;
}

// ---------------------------------------------------------------------------
// Status config (matches original App.jsx + task spec, ported to *-app vars)
// ---------------------------------------------------------------------------
const STATUS_AGENDAMENTO: Record<
  StatusAgendamento,
  { label: string; badge: string }
> = {
  aguardando: {
    label: "Aguardando chegar",
    badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-secondary)]",
  },
  atendido: {
    label: "Atendido",
    badge:
      "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
  },
  faltou: {
    label: "Faltou",
    badge: "bg-[var(--danger-app-bg-strong)] text-[var(--danger-app)]",
  },
  desmarcou: {
    label: "Desmarcou",
    badge: "bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)]",
  },
  remarcado: {
    label: "Remarcado",
    badge: "bg-[var(--warning-app-bg-strong)] text-[var(--warning-app)]",
  },
};

const STATUS_ORDER: StatusAgendamento[] = [
  "aguardando",
  "atendido",
  "faltou",
  "desmarcou",
  "remarcado",
];

// ---------------------------------------------------------------------------
// Shared style helpers (mirror T3-b / T3-c)
// ---------------------------------------------------------------------------
const inputCls =
  "bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] placeholder:text-[var(--text-app-faint)] focus-visible:border-[var(--accent-app)] focus-visible:ring-[var(--accent-app)]/25";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function diaOffset(iso: string, delta: number): string {
  // Use midday to avoid DST-shift edge cases when adding/subtracting days.
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatarDataLonga(iso: string): string {
  // "Sexta-feira, 26/09/2025"
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// ---------------------------------------------------------------------------
// Small UI primitives — match procedimentos-tab
// ---------------------------------------------------------------------------
function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--bg-app-alt-strong)] text-[var(--text-app-muted)] grid place-items-center mb-3">
        {icon}
      </div>
      <div className="text-sm font-medium text-[var(--text-app)]">{title}</div>
      {hint && (
        <div className="text-xs text-[var(--text-app-muted)] mt-1 max-w-sm">
          {hint}
        </div>
      )}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
      <AlertTriangle
        size={28}
        className="text-[var(--danger-app)]"
        strokeWidth={1.5}
      />
      <div className="text-sm text-[var(--text-app)]">Erro ao carregar</div>
      <div className="text-xs text-[var(--text-app-muted)] max-w-md">
        {message}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
      >
        <RefreshCw size={13} /> Tentar novamente
      </Button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 px-2 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-16 w-full bg-[var(--bg-app-alt-strong)]"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------
export function AgendaTab() {
  const queryClient = useQueryClient();
  const [dataSelecionada, setDataSelecionada] = useState<string>(hojeIso);

  // Form state (inline add)
  const [formNome, setFormNome] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formExame, setFormExame] = useState("");
  const [formPlano, setFormPlano] = useState(false);
  const [formParticular, setFormParticular] = useState(false);
  const [formHora, setFormHora] = useState("");

  const q = useQuery<Agendamento[]>({
    queryKey: ["agendamentos", dataSelecionada],
    queryFn: () =>
      apiFetch<Agendamento[]>(
        `/api/agendamentos?data=${encodeURIComponent(dataSelecionada)}`,
      ),
    enabled: Boolean(dataSelecionada),
  });

  const addMut = useMutation({
    mutationFn: (novo: {
      nome: string;
      telefone?: string;
      exame?: string;
      plano: boolean;
      particular: boolean;
      data: string;
      hora?: string;
    }) =>
      apiFetch<Agendamento>("/api/agendamentos", {
        method: "POST",
        body: JSON.stringify(novo),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agendamentos", dataSelecionada],
      });
      setFormNome("");
      setFormTelefone("");
      setFormExame("");
      setFormPlano(false);
      setFormParticular(false);
      setFormHora("");
      toast.success("Agendamento criado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusAgendamento }) =>
      apiFetch<Agendamento>(`/api/agendamentos/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agendamentos", dataSelecionada],
      });
      toast.success("Status atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remarcarMut = useMutation({
    mutationFn: ({
      id,
      novaData,
      novaHora,
    }: {
      id: string;
      novaData: string;
      novaHora?: string;
    }) =>
      apiFetch<Agendamento>(`/api/agendamentos/${id}/remarcar`, {
        method: "PUT",
        body: JSON.stringify({
          novaData,
          novaHora: novaHora || null,
        }),
      }),
    onSuccess: (_novo, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["agendamentos", dataSelecionada],
      });
      // Also invalidate the destination date so the new agendamento appears
      // there if/when the user navigates to it.
      if (vars.novaData && vars.novaData !== dataSelecionada) {
        queryClient.invalidateQueries({
          queryKey: ["agendamentos", vars.novaData],
        });
      }
      toast.success("Agendamento remarcado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/agendamentos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["agendamentos", dataSelecionada],
      });
      toast.success("Agendamento excluído.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nome = formNome.trim();
    if (!nome) {
      toast.error("Informe o nome do paciente.");
      return;
    }
    addMut.mutate({
      nome,
      telefone: formTelefone.trim() || undefined,
      exame: formExame.trim() || undefined,
      plano: formPlano,
      particular: formParticular,
      data: dataSelecionada,
      hora: formHora || undefined,
    });
  }

  const agendamentos = q.data ?? [];

  return (
    <div className="h-full overflow-y-auto scroll-thin p-4 sm:p-6 bg-[var(--bg-app)]">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* ---------------------------------------------------------------- */}
        {/* Day navigation                                                   */}
        {/* ---------------------------------------------------------------- */}
        <Card className="bg-[var(--surface-app)] border-[var(--border-app)] rounded-xl shadow-none p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() =>
                  setDataSelecionada((d) => diaOffset(d, -1))
                }
                title="Dia anterior"
                aria-label="Dia anterior"
                className="h-9 w-9 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDataSelecionada(hojeIso())}
                className="h-9 px-3 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                Hoje
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() =>
                  setDataSelecionada((d) => diaOffset(d, 1))
                }
                title="Próximo dia"
                aria-label="Próximo dia"
                className="h-9 w-9 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] hover:bg-[var(--bg-app-alt-strong)]"
              >
                <ChevronRight size={16} />
              </Button>
            </div>

            <div className="flex-1 min-w-0 px-1 sm:px-2">
              <div className="flex items-center gap-2">
                <CalendarDays
                  size={16}
                  className="text-[var(--text-app-muted)] shrink-0"
                />
                <span className="text-sm font-semibold text-[var(--accent-app-text)] capitalize truncate">
                  {formatarDataLonga(dataSelecionada)}
                </span>
                {dataSelecionada === hojeIso() && (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-app-muted)] bg-[var(--bg-app-alt-strong)] px-1.5 py-0.5 rounded">
                    hoje
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label
                htmlFor="ir-data"
                className="text-[11px] text-[var(--text-app-muted)] whitespace-nowrap"
              >
                Ir para
              </Label>
              <Input
                id="ir-data"
                type="date"
                value={dataSelecionada}
                onChange={(e) => {
                  if (e.target.value) setDataSelecionada(e.target.value);
                }}
                className={cn(inputCls, "h-9 w-[150px]")}
              />
            </div>
          </div>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Add appointment form (inline)                                    */}
        {/* ---------------------------------------------------------------- */}
        <Card className="bg-[var(--surface-app)] border-[var(--border-app)] rounded-xl shadow-none p-3 sm:p-4">
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="flex items-center gap-2">
              <Plus size={15} className="text-[var(--text-app-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--text-app)]">
                Novo agendamento
              </h3>
              <span className="text-[11px] text-[var(--text-app-muted)]">
                para {dataBR(dataSelecionada)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4 sm:col-span-2">
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Nome *
                </Label>
                <Input
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Nome do paciente"
                  className={cn(inputCls, "h-9")}
                />
              </div>

              <div className="lg:col-span-3">
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Telefone
                </Label>
                <Input
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className={cn(inputCls, "h-9")}
                />
              </div>

              <div className="lg:col-span-3">
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Exame
                </Label>
                <Input
                  value={formExame}
                  onChange={(e) => setFormExame(e.target.value)}
                  placeholder="Exame / procedimento"
                  className={cn(inputCls, "h-9")}
                />
              </div>

              <div className="lg:col-span-2">
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Hora
                </Label>
                <Input
                  type="time"
                  value={formHora}
                  onChange={(e) => setFormHora(e.target.value)}
                  className={cn(inputCls, "h-9")}
                />
              </div>

              <div className="flex items-center gap-5 lg:col-span-6 sm:col-span-2 h-9">
                <label className="flex items-center gap-2 text-sm text-[var(--text-app)] cursor-pointer select-none">
                  <Checkbox
                    checked={formPlano}
                    onCheckedChange={(v) => setFormPlano(v === true)}
                  />
                  Plano
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-app)] cursor-pointer select-none">
                  <Checkbox
                    checked={formParticular}
                    onCheckedChange={(v) => setFormParticular(v === true)}
                  />
                  Particular
                </label>
              </div>

              <div className="flex justify-end lg:col-span-6 sm:col-span-2 items-center">
                <Button
                  type="submit"
                  disabled={addMut.isPending || !formNome.trim()}
                  className="h-9 bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
                >
                  {addMut.isPending ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Agendar
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Status legend                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {Object.entries(STATUS_AGENDAMENTO).map(([k, v]) => (
            <span
              key={k}
              className={cn(
                "px-2 py-0.5 rounded-full text-[11px] font-medium",
                v.badge,
              )}
            >
              {v.label}
            </span>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Appointment list                                                 */}
        {/* ---------------------------------------------------------------- */}
        <Card className="bg-[var(--surface-app)] border-[var(--border-app)] rounded-xl shadow-none">
          <div className="px-4 py-3 border-b border-[var(--border-app-subtle)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays
                size={16}
                className="text-[var(--text-app-muted)]"
              />
              <h3 className="text-sm font-semibold text-[var(--text-app)]">
                Agendamentos
              </h3>
              <span className="text-[11px] text-[var(--text-app-muted)]">
                {agendamentos.length}
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-app-muted)]">
              {dataBR(dataSelecionada)}
            </span>
          </div>

          {q.isLoading ? (
            <ListSkeleton />
          ) : q.error ? (
            <ErrorState
              message={q.error.message}
              onRetry={() => q.refetch()}
            />
          ) : agendamentos.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} strokeWidth={1.5} />}
              title="Nenhum agendamento para este dia."
              hint="Adicione o primeiro acima."
            />
          ) : (
            <div className="max-h-[60vh] overflow-y-auto scroll-thin divide-y divide-[var(--border-app-subtle)]">
              {agendamentos.map((ag) => (
                <AppointmentRow
                  key={ag.id}
                  ag={ag}
                  onStatusChange={(status) =>
                    updateStatusMut.mutate({ id: ag.id, status })
                  }
                  onRemarcar={(novaData, novaHora) =>
                    remarcarMut.mutate({
                      id: ag.id,
                      novaData,
                      novaHora,
                    })
                  }
                  onDelete={() => deleteMut.mutate(ag.id)}
                  onJumpToDate={(d) => setDataSelecionada(d)}
                  isRemarcando={remarcarMut.isPending}
                  isStatusPending={updateStatusMut.isPending}
                  isDeleting={deleteMut.isPending}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppointmentRow — single appointment card with status quick actions, badges,
// remarcar inline form, and delete.
// ---------------------------------------------------------------------------
function AppointmentRow({
  ag,
  onStatusChange,
  onRemarcar,
  onDelete,
  onJumpToDate,
  isRemarcando,
  isStatusPending,
  isDeleting,
}: {
  ag: Agendamento;
  onStatusChange: (status: StatusAgendamento) => void;
  onRemarcar: (novaData: string, novaHora: string) => void;
  onDelete: () => void;
  onJumpToDate: (iso: string) => void;
  isRemarcando: boolean;
  isStatusPending: boolean;
  isDeleting: boolean;
}) {
  const [remarcarOpen, setRemarcarOpen] = useState(false);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
  }

  function handleConfirmarRemarcar(e: React.MouseEvent) {
    e.stopPropagation();
    if (!novaData) {
      toast.error("Informe a nova data.");
      return;
    }
    onRemarcar(novaData, novaHora);
    setRemarcarOpen(false);
    setNovaData("");
    setNovaHora("");
  }

  const st = STATUS_AGENDAMENTO[ag.status] ?? STATUS_AGENDAMENTO.aguardando;

  return (
    <div className="px-3 sm:px-4 py-3 hover:bg-[var(--bg-app-alt-strong)]/40 transition-colors">
      {/* Main row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-3">
        {/* Hora */}
        <div className="flex items-center gap-1.5 sm:w-16 shrink-0 mb-2 sm:mb-0">
          <Clock
            size={13}
            className="text-[var(--text-app-faint)] shrink-0"
          />
          <span className="text-sm font-mono tabular-nums text-[var(--text-app-secondary)]">
            {ag.hora || "Sem hora"}
          </span>
        </div>

        {/* Patient + badges */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--text-app)] truncate">
            {ag.nome}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-[11px] text-[var(--text-app-muted)]">
            {ag.telefone && (
              <span className="flex items-center gap-1">
                <Phone size={11} />
                {ag.telefone}
              </span>
            )}
            {ag.exame && (
              <span className="truncate max-w-[200px]">{ag.exame}</span>
            )}
            {!ag.telefone && !ag.exame && (
              <span className="text-[var(--text-app-faint)]">
                Sem detalhes
              </span>
            )}
          </div>

          {(ag.plano || ag.particular) && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {ag.plano && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-medium",
                    "bg-[var(--accent-app-soft-bg-strong)] text-[var(--accent-app-text)]",
                  )}
                >
                  Plano
                </span>
              )}
              {ag.particular && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  Particular
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status quick actions */}
        <div
          className="flex flex-col sm:items-end gap-1.5 mt-2 sm:mt-0 shrink-0"
          onClick={stop}
        >
          <div className="flex flex-wrap gap-1 sm:justify-end">
            {STATUS_ORDER.map((s) => {
              const conf = STATUS_AGENDAMENTO[s];
              const active = ag.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={isStatusPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(s);
                  }}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full border transition-colors disabled:opacity-50 cursor-pointer",
                    active
                      ? cn(conf.badge, "border-transparent font-medium")
                      : "bg-transparent text-[var(--text-app-muted)] border-[var(--border-app-subtle)] hover:bg-[var(--bg-app-alt-strong)]",
                  )}
                  title={conf.label}
                  aria-pressed={active}
                >
                  {conf.label}
                </button>
              );
            })}
          </div>

          {/* Remarcado link */}
          {ag.status === "remarcado" && ag.remarcadoParaData && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onJumpToDate(ag.remarcadoParaData as string);
              }}
              className="flex items-center gap-1 text-[11px] text-[var(--warning-app)] hover:underline mt-0.5"
              title="Ir para o dia remarcado"
            >
              <CalendarClock size={12} />
              ver remarcação {dataBR(ag.remarcadoParaData)}
              {ag.remarcadoParaHora ? ` ${ag.remarcadoParaHora}` : ""}
            </button>
          )}
        </div>
      </div>

      {/* Row actions */}
      <div
        className="flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t border-[var(--border-app-subtle)] sm:ml-[76px]"
        onClick={stop}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            setRemarcarOpen((v) => !v);
            setNovaData("");
            setNovaHora("");
          }}
          className="h-7 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app-secondary)] hover:bg-[var(--bg-app-alt-strong)] text-xs"
        >
          <CalendarClock size={12} />
          Remarcar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="h-7 bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--danger-app)] hover:bg-[var(--danger-app-bg-strong)] text-xs"
        >
          {isDeleting ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <Trash2 size={12} />
          )}
          Excluir
        </Button>

        {/* Inline status indicator (subtle reminder of current status) */}
        <span
          className={cn(
            "ml-auto text-[10px] px-1.5 py-0.5 rounded-full",
            st.badge,
          )}
        >
          {st.label}
        </span>
      </div>

      {/* Inline remarcar form */}
      <AnimatePresence initial={false}>
        {remarcarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="mt-2.5 sm:ml-[76px] p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-app-subtle)] flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3"
              onClick={stop}
            >
              <div>
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Nova data *
                </Label>
                <Input
                  type="date"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className={cn(inputCls, "h-9 w-full sm:w-[160px]")}
                />
              </div>
              <div>
                <Label className="text-[11px] text-[var(--text-app-muted)] mb-1 block">
                  Nova hora
                </Label>
                <Input
                  type="time"
                  value={novaHora}
                  onChange={(e) => setNovaHora(e.target.value)}
                  className={cn(inputCls, "h-9 w-full sm:w-[120px]")}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemarcarOpen(false);
                    setNovaData("");
                    setNovaHora("");
                  }}
                  className="h-9 text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isRemarcando || !novaData}
                  onClick={handleConfirmarRemarcar}
                  className="h-9 bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]"
                >
                  {isRemarcando ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  Confirmar remarcação
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
