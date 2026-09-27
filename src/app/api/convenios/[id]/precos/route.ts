import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface TabelaPrecoCreateBody {
  procedimentoId?: string;
  valor?: number;
  vigenciaInicio?: string;
}

// GET /api/convenios/[id]/precos
// Lista o historico de precos do convenio informado, com join no
// procedimento (nome). Ordenacao: nome do procedimento ASC, depois vigencia
// DESC (regra mais recente primeiro dentro de cada procedimento). Requer
// apenas Bearer. Retorna array achatado com `procedimentoNome`.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const { id } = await params;

    const rows = await db.convenioTabelaPreco.findMany({
      where: { convenioId: id },
      include: { procedimento: { select: { nome: true } } },
      orderBy: [{ procedimento: { nome: "asc" } }, { vigenciaInicio: "desc" }],
    });

    const result = rows.map(({ procedimento, ...ctp }) => ({
      ...ctp,
      procedimentoNome: procedimento?.nome ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/convenios/[id]/precos
// SEMPRE insere uma nova linha de vigencia — nunca sobrescreve a anterior.
// Isso preserva o valor para exames antigos ("congelar a regra comercial").
// Default: vigenciaInicio = data de hoje (YYYY-MM-DD). Requer papel dono ou
// financeiro. Retorna 201 com a linha criada.
export async function POST(
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

    const { id } = await params;

    const body = (await req.json().catch(() => ({}))) as TabelaPrecoCreateBody;
    const { procedimentoId, valor, vigenciaInicio } = body;

    const novoId = crypto.randomUUID();
    const criado = await db.convenioTabelaPreco.create({
      data: {
        id: novoId,
        convenioId: id,
        procedimentoId: procedimentoId ?? "",
        valor: valor ?? 0,
        vigenciaInicio: vigenciaInicio || new Date().toISOString().slice(0, 10),
      },
    });

    return NextResponse.json(criado, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
