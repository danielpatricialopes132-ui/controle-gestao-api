import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const body = await request.json();
    const { texto, obraId } = body; // data no longer strictly required, AI will extract from text

    if (!texto || !obraId) {
      return NextResponse.json({ success: false, error: 'texto e obraId são obrigatórios' }, { status: 400 });
    }

    const tenantId = userAuth.tenantId;

    // Verificar se a obra pertence ao tenant
    const obra = await prisma.obra.findUnique({
      where: { id: obraId, tenantId },
    });

    if (!obra) {
      return NextResponse.json({ success: false, error: 'Obra não encontrada' }, { status: 404 });
    }

    // Buscar os funcionários atuais do tenant (que podem estar vinculados à obra futuramente)
    const funcionarios = await prisma.funcionario.findMany({
      where: { tenantId },
      select: { id: true, nome: true, cargo: true }
    });

    // Se a chave não existir, retornar erro
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: 'Chave do Gemini não configurada no servidor' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Recomendação: gemini-1.5-flash para extração rápida e JSON garantido
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Você é um assistente de RH para obras de construção civil. 
Abaixo está o texto de uma escala (geralmente copiada do WhatsApp) e a lista de funcionários ativos no sistema.

Texto da Escala:
"""
${texto}
"""

Funcionários Cadastrados:
${funcionarios.map(f => `- [ID: ${f.id}] ${f.nome} (${f.cargo})`).join('\n')}

**Instruções de Extração:**
1. Leia o "Texto da Escala". Ele pode conter datas, nomes, apelidos, cargos e a indicação de quem trabalhou ("ok", "presente", "falta", "viagem", etc).
2. Identifique os dias de trabalho listados no texto.
3. Para cada dia, identifique as pessoas listadas e o status de presença de cada uma. Assuma que trabalharam (TRABALHO) a menos que esteja explícito (FALTA, VIAGEM, CHUVA).
4. Para cada pessoa, tente encontrar uma correspondência na lista de "Funcionários Cadastrados" (mesmo com erros de digitação/apelidos). 
5. Se encontrar correspondência, coloque em "reconhecidos" com o ID exato.
6. Se não encontrar correspondência, coloque APENAS o nome na lista "naoReconhecidos" (esta lista é global para toda a resposta, contendo todos os nomes não reconhecidos que apareceram).

Retorne APENAS um JSON válido no seguinte formato e não adicione crases Markdown de bloco de código:
{
  "dias": [
    {
      "dataStr": "YYYY-MM-DD",
      "reconhecidos": [
        {
          "funcionarioId": "id-do-banco",
          "nomeEncontrado": "nome como no banco",
          "status": "TRABALHO",
          "horasTrabalhadas": 8,
          "percentualPago": 100,
          "observacao": "..."
        }
      ]
    }
  ],
  "naoReconhecidos": [
    "Nome ou Apelido da pessoa 1",
    "Pessoa 2"
  ]
}
`;

    const result = await model.generateContent(prompt);
    let textResult = result.response.text().trim();
    
    // Remover blocos de código se o modelo insistir
    if (textResult.startsWith('\`\`\`json')) {
      textResult = textResult.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    } else if (textResult.startsWith('\`\`\`')) {
      textResult = textResult.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
    }

    const jsonParsed = JSON.parse(textResult);

    return NextResponse.json({
      success: true,
      data: jsonParsed
    });

  } catch (error: any) {
    console.error('Erro na Importação de Texto API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
