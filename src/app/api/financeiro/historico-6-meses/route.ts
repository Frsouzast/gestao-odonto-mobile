import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

interface MesData {
  mes: string; // "YYYY-MM"
  receitas: number;
  despesas: number;
  resultado: number;
  aReceber: number;
  aPagar: number;
}

// GET /api/financeiro/historico-6-meses?ate=YYYY-MM (opcional, default mês atual)
// Retorna 6 meses terminando no mês "ate" (ou no atual), com receitas/despesas/resultado.
// Útil para mini-sparklines no Dashboard inicial.
export async function GET(req: NextRequest) {
  try {
    const payload = authRequired(req);
    if ("erro" in payload) {
      return NextResponse.json({ erro: payload.erro }, { status: payload.status });
    }

    const url = new URL(req.url);
    const ateParam = url.searchParams.get("ate");
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1; // 1-12
    const ateAno = ateParam ? parseInt(ateParam.slice(0, 4)) : anoAtual;
    const ateMes = ateParam ? parseInt(ateParam.slice(5, 7)) : mesAtual;

    if (isNaN(ateAno) || isNaN(ateMes) || ateMes < 1 || ateMes > 12) {
      return NextResponse.json(
        { erro: "Parâmetro 'ate' inválido. Use YYYY-MM." },
        { status: 400 }
      );
    }

    // Gera 6 meses terminando em "ate" (mais antigo → mais recente)
    const meses: string[] = [];
    let a = ateAno;
    let m = ateMes;
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(a, m - 1 - i, 1);
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      meses.push(`${yy}-${mm}`);
    }

    const resultado: MesData[] = [];

    for (const mes of meses) {
      const prefixo = `${mes}-`; // YYYY-MM- (LIKE pattern)
      const [receberMes, pagarMes] = await Promise.all([
        db.contaReceber.findMany({
          where: { clinicaId: payload.clinicaId, dataExame: { startsWith: prefixo } },
          select: { status: true, valorPago: true, valorFaturado: true },
        }),
        db.contaPagar.findMany({
          where: { clinicaId: payload.clinicaId, vencimento: { startsWith: prefixo } },
          select: { status: true, valor: true },
        }),
      ]);

      const receitas = receberMes
        .filter((r) => r.status === "recebido" || r.status === "parcial")
        .reduce((s, r) => s + Number(r.valorPago ?? r.valorFaturado), 0);

      const despesas = pagarMes
        .filter((p) => p.status === "pago")
        .reduce((s, p) => s + Number(p.valor), 0);

      const aReceber = receberMes
        .filter((r) => ["aberto", "vencido", "parcial"].includes(r.status))
        .reduce((s, r) => s + Number(r.valorFaturado), 0);

      const aPagar = pagarMes
        .filter((p) => ["aberto", "vencido"].includes(p.status))
        .reduce((s, p) => s + Number(p.valor), 0);

      resultado.push({
        mes,
        receitas,
        despesas,
        resultado: receitas - despesas,
        aReceber,
        aPagar,
      });
    }

    return NextResponse.json(resultado);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
