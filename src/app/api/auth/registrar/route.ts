import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashSenha, gerarToken, type Papel } from "@/lib/auth";

interface RegistrarBody {
  clinicaNome?: string;
  usuarioNome?: string;
  email?: string;
  senha?: string;
}

// POST /api/auth/registrar
// Cria uma nova clinica + um usuario dono. Retorna token + sessao.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as RegistrarBody;
    const { clinicaNome, usuarioNome, email, senha } = body;

    if (!clinicaNome || !usuarioNome || !email || !senha) {
      return NextResponse.json(
        { erro: "clinicaNome, usuarioNome, email e senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (senha.length < 8) {
      return NextResponse.json(
        { erro: "A senha precisa ter pelo menos 8 caracteres." },
        { status: 400 }
      );
    }

    const clinicaId = crypto.randomUUID();
    const usuarioId = crypto.randomUUID();
    const emailNormalizado = email.toLowerCase();
    const papel: Papel = "dono";

    try {
      // Hash antes da transacao para minimizar o tempo de lock.
      const senhaHash = await hashSenha(senha);
      // Transacao: se o usuario (email unico) falhar, a clinica nao fica orfa.
      await db.$transaction([
        db.clinica.create({
          data: { id: clinicaId, nome: clinicaNome },
        }),
        db.usuario.create({
          data: {
            id: usuarioId,
            clinicaId,
            nome: usuarioNome,
            email: emailNormalizado,
            senhaHash,
            papel,
          },
        }),
      ]);
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

    const token = gerarToken({ usuarioId, clinicaId, papel });

    return NextResponse.json(
      {
        token,
        usuario: {
          id: usuarioId,
          nome: usuarioNome,
          email: emailNormalizado,
          papel,
        },
        clinica: { id: clinicaId, nome: clinicaNome },
      },
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
