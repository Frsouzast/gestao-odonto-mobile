import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

interface AgendamentoCreateBody {
  nome?: string;
  telefone?: string | null;
  exame?: string | null;
  plano?: unknown;
  particular?: unknown;
  data?: string;
  hora?: string | null;
}

// GET /api/agendamentos?data=YYYY-MM-DD
// Lista todos os agendamentos da clinica do usuario autenticado para a data
// informada. Obrigatorio ?data=AAAA-MM-DD. Inclui os dados do agendamento
// para o qual este foi remarcado (remarcadoPara.data/hora) achatados em
// remarcadoParaData/remarcadoParaHora — fiel ao `left join agendamento r` do
// SQL original. Ordenacao: hora NULL primeiro, depois hora ASC (sort em JS
// porque o Prisma do SQLite nao suporta `nulls: 'first'` de forma portavel).
// Aberto a qualquer papel autenticado (agendar nao e acao financeira).
export async function GET(req: NextRequest) {
  try {
    const auth = authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const data = req.nextUrl.searchParams.get("data");
    if (!data) {
      return NextResponse.json(
        { erro: "Informe ?data=AAAA-MM-DD." },
        { status: 400 }
      );
    }

    const rows = await db.agendamento.findMany({
      where: { clinicaId: auth.clinicaId, data },
      include: {
        remarcadoPara: { select: { data: true, hora: true } },
      },
    });

    // NULLs primeiro, depois hora ASC (lexicografico para strings "HH:MM").
    rows.sort((a, b) => {
      const aNull = !a.hora;
      const bNull = !b.hora;
      if (aNull && bNull) return 0;
      if (aNull) return -1;
      if (bNull) return 1;
      return (a.hora as string).localeCompare(b.hora as string);
    });

    const result = rows.map(({ remarcadoPara, ...agendamento }) => ({
      ...agendamento,
      remarcadoParaData: remarcadoPara?.data ?? null,
      remarcadoParaHora: remarcadoPara?.hora ?? null,
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

// POST /api/agendamentos
// Cria um novo agendamento. Requer nome e data (400 se ausente). plano e
// particular sao booleanos (default false via schema Prisma). Aberto a
// qualquer papel autenticado. Retorna 201 com a linha criada.
export async function POST(req: NextRequest) {
  try {
    const auth = authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as AgendamentoCreateBody;
    const { nome, telefone, exame, plano, particular, data, hora } = body;

    if (!nome || !data) {
      return NextResponse.json(
        { erro: "nome e data são obrigatórios." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const criado = await db.agendamento.create({
      data: {
        id,
        clinicaId: auth.clinicaId,
        nome,
        telefone: telefone || null,
        exame: exame || null,
        plano: Boolean(plano),
        particular: Boolean(particular),
        data,
        hora: hora || null,
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
