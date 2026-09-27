import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashSenha, authRequired, type Papel } from "@/lib/auth";

interface ConvidarBody {
  nome?: string;
  email?: string;
  senha?: string;
  papel?: string;
}

const PAPEIS_CONVITE: Papel[] = ["financeiro", "recepcao"];

// POST /api/auth/convidar
// Dono convida um novo usuario (financeiro|recepcao) para a sua clinica.
export async function POST(req: NextRequest) {
  try {
    const payload = authRequired(req);
    if ("erro" in payload) {
      return NextResponse.json(
        { erro: payload.erro },
        { status: payload.status }
      );
    }

    if (payload.papel !== "dono") {
      return NextResponse.json(
        { erro: "Só o dono da clínica pode convidar novos usuários." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ConvidarBody;
    const { nome, email, senha, papel } = body;

    if (!papel || !PAPEIS_CONVITE.includes(papel as Papel)) {
      return NextResponse.json(
        { erro: "papel precisa ser 'financeiro' ou 'recepcao'." },
        { status: 400 }
      );
    }

    if (!nome || !email || !senha) {
      return NextResponse.json(
        { erro: "nome, email e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const emailNormalizado = email.toLowerCase();
    const papelValido = papel as Papel;

    try {
      const senhaHash = await hashSenha(senha);
      await db.usuario.create({
        data: {
          id,
          clinicaId: payload.clinicaId,
          nome,
          email: emailNormalizado,
          senhaHash,
          papel: papelValido,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json(
          { erro: "Já existe uma conta com esse e-mail." },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json(
      { id, nome, email: emailNormalizado, papel: papelValido },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
