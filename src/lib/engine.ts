// Motor de cálculo de custo fixo por minuto e precificação de procedimentos.
// Funções puras (sem I/O) — replica exatamente o engine.js do app Electron original,
// para que os mesmos testes contra a planilha original continuem válidos.

export interface Despesa {
  valor: number;
}

export interface Capacidade {
  diasTrabalhados: number;
  horasPorDia: number;
  unidadesRenda: number;
  percentOcupacao: number;
}

export interface ItemProcedimento {
  insumoId: string;
  quantidade: number;
}

export interface ProcedimentoInput {
  tempoMinutos: number;
  laudos: number;
  retrabalho: number;
  itens: ItemProcedimento[];
  comissao: number;
  lucroDesejado: number;
  inadimplencia: number;
  impostos: number;
  taxaCartao: number;
  outrosPct?: number;
  precoFinal?: number;
}

export interface ResultadoProcedimento {
  custoInsumos: number;
  rateio: number;
  retrabalhoValor: number;
  custoDireto: number;
  precoSugerido: number;
  pontoEquilibrio: number;
  lucratividadeFinal: number;
}

export function custoFixoTotal(despesas: Despesa[]): number {
  return despesas.reduce((soma, d) => soma + (d.valor || 0), 0);
}

export function horasEfetivas(capacidade: Capacidade): number {
  const { diasTrabalhados, horasPorDia, unidadesRenda, percentOcupacao } =
    capacidade;
  return diasTrabalhados * horasPorDia * unidadesRenda * percentOcupacao;
}

export function custoFixoPorHora(
  despesas: Despesa[],
  capacidade: Capacidade
): number {
  const horas = horasEfetivas(capacidade);
  if (horas <= 0) return 0;
  return custoFixoTotal(despesas) / horas;
}

export function custoFixoPorMinuto(
  despesas: Despesa[],
  capacidade: Capacidade
): number {
  return custoFixoPorHora(despesas, capacidade) / 60;
}

export function insumoUnitCost(insumo: {
  valorTotal: number;
  quantidade: number;
}): number {
  if (!insumo || !insumo.quantidade) return 0;
  return insumo.valorTotal / insumo.quantidade;
}

export function calcProcedimento(
  proc: ProcedimentoInput,
  custoMinuto: number,
  custoUnitarioInsumo: (insumoId: string) => number
): ResultadoProcedimento {
  const outrosPct = proc.outrosPct || 0;

  const custoInsumos = proc.itens.reduce(
    (soma, item) => soma + item.quantidade * custoUnitarioInsumo(item.insumoId),
    0
  );
  const rateio = proc.tempoMinutos * custoMinuto;
  const retrabalhoValor = (rateio + custoInsumos) * proc.retrabalho;
  const custoDireto = rateio + custoInsumos + retrabalhoValor + proc.laudos;

  const somaPercentComLucro =
    outrosPct +
    proc.comissao +
    proc.lucroDesejado +
    proc.inadimplencia +
    proc.impostos +
    proc.taxaCartao;
  const somaPercentSemLucro =
    outrosPct +
    proc.comissao +
    proc.inadimplencia +
    proc.impostos +
    proc.taxaCartao;

  const precoSugerido =
    somaPercentComLucro < 1 ? custoDireto / (1 - somaPercentComLucro) : NaN;
  const pontoEquilibrio =
    somaPercentSemLucro < 1 ? custoDireto / (1 - somaPercentSemLucro) : NaN;

  // Mantido fiel ao cálculo da planilha original (retrabalho só sobre insumos aqui).
  const retrabalhoSobreInsumos = custoInsumos * proc.retrabalho;
  const precoFinal = proc.precoFinal || 0;
  const lucratividadeFinal =
    precoFinal > 0
      ? (precoFinal -
          precoFinal * somaPercentSemLucro -
          proc.laudos -
          custoInsumos -
          rateio -
          retrabalhoSobreInsumos) /
        precoFinal
      : NaN;

  return {
    custoInsumos,
    rateio,
    retrabalhoValor,
    custoDireto,
    precoSugerido,
    pontoEquilibrio,
    lucratividadeFinal,
  };
}
