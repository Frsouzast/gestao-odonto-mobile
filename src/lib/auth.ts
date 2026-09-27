import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "dev-secret-troque-isto-em-producao";
const JWT_EXPIRES_IN = "7d";

export type Papel = "dono" | "financeiro" | "recepcao";

export interface JwtPayload {
  usuarioId: string;
  clinicaId: string;
  papel: Papel;
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function conferirSenha(
  senha: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export function gerarToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verificarToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * Extrai o usuário autenticado a partir do header Authorization.
 * Retorna null se ausente/inválido — o caller decide se 401 ou 403.
 */
export function lerUsuarioDoHeader(req: Request): JwtPayload | null {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return verificarToken(token);
  } catch {
    return null;
  }
}

export function authRequired(req: Request): JwtPayload | { erro: string; status: number } {
  const payload = lerUsuarioDoHeader(req);
  if (!payload) {
    return { erro: "Faça login: token ausente ou inválido no header Authorization.", status: 401 };
  }
  return payload;
}

export type AuthPapelResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false; erro: string; status: number };

export function authPapel(...papeis: Papel[]) {
  return (payload: JwtPayload): AuthPapelResult => {
    if (!papeis.includes(payload.papel)) {
      return {
        ok: false,
        erro: `Esta ação exige um dos papéis: ${papeis.join(", ")}.`,
        status: 403,
      };
    }
    return { ok: true, payload };
  };
}

export const podeEditar = authPapel("dono", "financeiro");
