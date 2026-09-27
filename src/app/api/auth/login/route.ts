import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conferirSenha, gerarToken, type Papel } from "@/lib/auth";

interface LoginBody {
  email?: string;
  senha?: string;
}

// POST /api/auth/login
// Autentica um usuario por email + senha. Retorna token + sessao.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as LoginBody;
    const { email, senha } = body;

    if (!email || !senha) {
      return NextResponse.json(
        { erro: "email e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const emailNormalizado = email.toLowerCase();

    const usuario = await db.usuario.findUnique({
      where: { email: emailNormalizado },
      include: { clinica: true },
    });

    const credenciaisInvalidas = () =>
      NextResponse.json(
        { erro: "E-mail ou senha inválidos." },
        { status: 401 }
      );

    if (!usuario) return credenciaisInvalidas();

    const ok = await conferirSenha(senha, usuario.senhaHash);
    if (!ok) return credenciaisInvalidas();

    const papel = usuario.papel as Papel;
    const token = gerarToken({
      usuarioId: usuario.id,
      clinicaId: usuario.clinicaId,
      papel,
    });

    return NextResponse.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel,
      },
      clinica: { id: usuario.clinica.id, nome: usuario.clinica.nome },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { erro: "Erro interno ao processar a requisição." },
      { status: 500 }
    );
  }
}
