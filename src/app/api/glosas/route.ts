import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRequired } from "@/lib/auth";

// GET /api/glosas
// Lista as glosas da clinica, com join em conta_receber e convenio para
// trazer o nome do paciente, valor faturado, data do exame e nome do
// convenio. Filtra por clinicaId atraves da relacao contaReceber.clinicaId
// (a tabela glosa em si nao tem clinicaId direto). Ordenacao: criadoEm DESC.
// Requer apenas Bearer.
//
// Retorno achatado para `[{...g, pacienteNome, valorFaturado, dataExame, convenioNome}]`
// (o relation contaReceber e removido do spread para nao vazar dados do
// paciente/convenio alem dos 4 campos explicitamente achatados).
export async function GET(req: NextRequest) {
  try {
    const auth = authRequired(req);
    if ("erro" in auth) {
      return NextResponse.json({ erro: auth.erro }, { status: auth.status });
    }

    const rows = await db.glosa.findMany({
      where: { contaReceber: { clinicaId: auth.clinicaId } },
      include: {
        contaReceber: { include: { convenio: true } },
      },
      orderBy: { criadoEm: "desc" },
    });

    const result = rows.map(({ contaReceber, ...g }) => ({
      ...g,
      pacienteNome: contaReceber?.pacienteNome ?? null,
      valorFaturado: contaReceber?.valorFaturado ?? null,
      dataExame: contaReceber?.dataExame ?? null,
      convenioNome: contaReceber?.convenio?.nome ?? null,
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
