import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface ProcedimentoUpdateBody {
  nome?: string;
  tempoMinutos?: number;
  laudos?: number;
  retrabalhoPct?: number;
  comissaoPct?: number;
  lucroDesejadoPct?: number;
  inadimplenciaPct?: number;
  impostosPct?: number;
  taxaCartaoPct?: number;
  outrosPct?: number;
  precoConcorrencia?: number;
  equipamentoId?: string;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && !Number.isNaN(v);

// PUT /api/procedimentos/[id]
// Atualiza apenas os campos fornecidos entre os parametros de precificacao do
// procedimento. Requer papel dono ou financeiro. Retorna 404 se o procedimento
// nao existir na clinica do usuario autenticado.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const check = podeEditar(auth);
    if (!check.ok) {
      return NextResponse.json({ erro: check.erro }, { status: check.status });
    }
    const payload = check.payload;

    const { id } = await params;

    const existente = await db.procedimento.findFirst({
      where: { id, clinicaId: payload.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Procedimento não encontrado." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ProcedimentoUpdateBody;
    const data: {
      nome?: string;
      tempoMinutos?: number;
      laudos?: number;
      retrabalhoPct?: number;
      comissaoPct?: number;
      lucroDesejadoPct?: number;
      inadimplenciaPct?: number;
      impostosPct?: number;
      taxaCartaoPct?: number;
      outrosPct?: number;
      precoConcorrencia?: number;
      equipamentoId?: string;
    } = {};
    if (typeof body.nome === "string") data.nome = body.nome;
    if (isNum(body.tempoMinutos)) data.tempoMinutos = body.tempoMinutos;
    if (isNum(body.laudos)) data.laudos = body.laudos;
    if (isNum(body.retrabalhoPct)) data.retrabalhoPct = body.retrabalhoPct;
    if (isNum(body.comissaoPct)) data.comissaoPct = body.comissaoPct;
    if (isNum(body.lucroDesejadoPct)) data.lucroDesejadoPct = body.lucroDesejadoPct;
    if (isNum(body.inadimplenciaPct)) data.inadimplenciaPct = body.inadimplenciaPct;
    if (isNum(body.impostosPct)) data.impostosPct = body.impostosPct;
    if (isNum(body.taxaCartaoPct)) data.taxaCartaoPct = body.taxaCartaoPct;
    if (isNum(body.outrosPct)) data.outrosPct = body.outrosPct;
    if (isNum(body.precoConcorrencia)) data.precoConcorrencia = body.precoConcorrencia;
    if (typeof body.equipamentoId === "string") data.equipamentoId = body.equipamentoId;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { erro: "Nenhum campo reconhecido para atualizar." },
        { status: 400 }
      );
    }

    const atualizado = await db.procedimento.update({
      where: { id },
      data,
    });

    return NextResponse.json(atualizado);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// DELETE /api/procedimentos/[id]
// Soft-delete: marca ativo=false em vez de remover a linha fisicamente,
// preservando o historico de precos e os itens vinculados.
// Requer papel dono ou financeiro. Retorna 204 (idempotente).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const check = podeEditar(auth);
    if (!check.ok) {
      return NextResponse.json({ erro: check.erro }, { status: check.status });
    }
    const payload = check.payload;

    const { id } = await params;

    await db.procedimento.updateMany({
      where: { id, clinicaId: payload.clinicaId },
      data: { ativo: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
