import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

// GET /api/usuarios
// Lista os usuarios da clinica do usuario autenticado.
// Nunca expoe senhaHash (uso de `select`).
export async function GET(req: NextRequest) {
  try {
    const payload = authRequired(req);
    if ("erro" in payload) {
      return NextResponse.json(
        { erro: payload.erro },
        { status: payload.status }
      );
    }

    const usuarios = await db.usuario.findMany({
      where: { clinicaId: payload.clinicaId },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
      },
    });

    return NextResponse.json(usuarios);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
