import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

interface AgendamentoUpdateBody {
  nome?: string;
  telefone?: string | null;
  exame?: string | null;
  plano?: unknown;
  particular?: unknown;
  data?: string;
  hora?: string | null;
  status?: string;
}

// PUT /api/agendamentos/[id]
// Atualiza apenas os campos fornecidos entre nome, telefone, exame, plano,
// particular, data, hora e status. Para plano/particular o valor e coercido
// para boolean (Boolean(body[key])) — fiel ao `? 1 : 0` do SQL original.
// Retorna 404 se o agendamento nao existir na clinica do usuario autenticado.
// Aberto a qualquer papel autenticado (agendar nao e acao financeira).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const { id } = await params;

    const existente = await db.agendamento.findFirst({
      where: { id, clinicaId: auth.clinicaId },
    });
    if (!existente) {
      return NextResponse.json(
        { erro: "Agendamento não encontrado." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as AgendamentoUpdateBody;

    const data: {
      nome?: string;
      telefone?: string | null;
      exame?: string | null;
      plano?: boolean;
      particular?: boolean;
      data?: string;
      hora?: string | null;
      status?: string;
    } = {};
    if (body.nome !== undefined) data.nome = body.nome;
    if (body.telefone !== undefined) data.telefone = body.telefone ?? null;
    if (body.exame !== undefined) data.exame = body.exame ?? null;
    if (body.plano !== undefined) data.plano = Boolean(body.plano);
    if (body.particular !== undefined) data.particular = Boolean(body.particular);
    if (body.data !== undefined) data.data = body.data;
    if (body.hora !== undefined) data.hora = body.hora ?? null;
    if (body.status !== undefined) data.status = body.status;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { erro: "Nenhum campo reconhecido para atualizar." },
        { status: 400 }
      );
    }

    const atualizado = await db.agendamento.update({
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

// DELETE /api/agendamentos/[id]
// Remove o agendamento se pertencer a clinica do usuario autenticado.
// Retorna 204 (idempotente via `deleteMany` por {id, clinicaId}).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const { id } = await params;

    await db.agendamento.deleteMany({
      where: { id, clinicaId: auth.clinicaId },
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
