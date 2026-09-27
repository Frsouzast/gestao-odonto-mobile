import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired, podeEditar } from "@/lib/auth";

interface ProcedimentoBody {
  nome?: string;
  tempoMinutos?: number;
  laudos?: number;
  retrabalhoPct?: number;
}

// GET /api/procedimentos
// Lista todos os procedimentos ativos da clinica do usuario autenticado,
// ordenados por nome. Soft-delete (ativo=false) exclui da listagem.
export async function GET(req: NextRequest) {
  try {
    const auth = authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const procedimentos = await db.procedimento.findMany({
      where: { clinicaId: auth.clinicaId, ativo: true },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(procedimentos);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}

// POST /api/procedimentos
// Cria um novo procedimento para a clinica. Requer papel dono ou financeiro.
// Defaults: tempoMinutos=0, laudos=0, retrabalhoPct=0.03 (se ausente/nulo).
export async function POST(req: NextRequest) {
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

    const body = (await req.json().catch(() => ({}))) as ProcedimentoBody;
    const { nome, tempoMinutos, laudos, retrabalhoPct } = body;

    if (!nome || typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json(
        { erro: "nome é obrigatório." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const criado = await db.procedimento.create({
      data: {
        id,
        clinicaId: payload.clinicaId,
        nome,
        tempoMinutos: tempoMinutos || 0,
        laudos: laudos || 0,
        retrabalhoPct: retrabalhoPct ?? 0.03,
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
