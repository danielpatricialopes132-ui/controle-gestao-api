import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const usuarioDb = await prisma.usuario.findUnique({
      where: { firebaseUid: auth.uid },
      select: { id: true, nome: true, tenantId: true },
    });

    if (!usuarioDb) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { promptTexto, dataReferencia } = body;

    if (!promptTexto) {
      return NextResponse.json({ error: "O texto para agendamento é obrigatório." }, { status: 400 });
    }

    // Busca colaboradores e obras do tenant para que o LLM identifique nomes e entidades
    const [colaboradores, obras] = await Promise.all([
      prisma.usuario.findMany({
        where: { tenantId: usuarioDb.tenantId, status: "ATIVO" },
        select: { id: true, nome: true, email: true },
      }),
      prisma.obras.findMany({
        where: { tenantId: usuarioDb.tenantId },
        select: { id: true, nome: true },
      }).catch(async () => {
        return prisma.obra.findMany({
          where: { tenantId: usuarioDb.tenantId },
          select: { id: true, nome: true },
        });
      }),
    ]);

    const dataHojeIso = dataReferencia || new Date().toISOString();

    const promptSistema = `
Você é a IA assistente de agendamento inteligente do ERP Controle & Gestão.
Data/Hora de referência atual: ${dataHojeIso}.

Lista de colaboradores cadastrados na empresa:
${JSON.stringify(colaboradores)}

Lista de obras cadastradas:
${JSON.stringify(obras)}

O usuário escreveu em linguagem natural um pedido para agendar um compromisso ou reunião:
"${promptTexto}"

Sua tarefa é extrair e estruturar os dados do compromisso em formato JSON rigoroso:
{
  "titulo": "Título claro e objetivo do compromisso",
  "descricao": "Detalhes ou pauta mencionada",
  "tipo": "PROFISSIONAL" ou "PESSOAL",
  "dataInicio": "YYYY-MM-DDTHH:mm:ssZ (ISO 8601)",
  "dataFim": "YYYY-MM-DDTHH:mm:ssZ (ISO 8601, assuma 1 hora de duração se não especificado)",
  "diaInteiro": false,
  "local": "Local físico ou link caso mencionado, ou null",
  "obraId": "ID da obra se alguma das obras cadastradas foi mencionada, senão null",
  "participantesIds": ["IDs dos colaboradores encontrados na lista acima que foram citados"],
  "lembreteMinutos": 15
}
Retorne APENAS o JSON puro, sem markdown delimitador de código (sem \`\`\`json).
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(promptSistema);
    const resposta = await result.response;
    let textoJson = resposta.text()?.trim() || "{}";

    if (textoJson.startsWith("```json")) {
      textoJson = textoJson.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (textoJson.startsWith("```")) {
      textoJson = textoJson.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const dadosExtraidos = JSON.parse(textoJson);

    return NextResponse.json({
      success: true,
      dadosExtraidos,
    });
  } catch (error: any) {
    console.error("Erro na interpretação da agenda inteligente:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
