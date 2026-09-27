import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface GlosaUpdateBody {
  status?: string;
  valorRecuperado?: number;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && !Number.isNaN(v);

// PUT /api/glosas/[id]
// Atualiza status e/ou valorRecuperado de uma glosa (marcar como recuperada,
// em recurso, perdida). Requer papel dono ou financeiro.
//
// Nota de isolamento multi-tenant: a tabela glosa nao tem clinicaId direto,
// mas o briefing especifica 404 se a linha nao existir (nao ha exigencia de
// checar clinicaId aqui). Mantemos o `findFirst` por `id` apenas para devolver
// 404 limpo quando a glosa nao existe (evita estourar P2025 do Prisma no
// `update` direto).
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

    const { id } = await params;

    const existente = await db.glosa.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Glosa não encontrada." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as GlosaUpdateBody;

    const data: { status?: string; valorRecuperado?: number } = {};
    if (typeof body.status === "string") data.status = body.status;
    if (isNum(body.valorRecuperado))
      data.valorRecuperado = body.valorRecuperado;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { erro: "Nenhum campo reconhecido para atualizar." },
        { status: 400 }
      );
    }

    const atualizado = await db.glosa.update({
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
