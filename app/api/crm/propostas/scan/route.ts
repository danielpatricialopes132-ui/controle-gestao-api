import { NextResponse } from "next/server";
import { verifyIdToken } from '@/lib/auth';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const { base64, mimeType } = body;

    if (!base64 || !mimeType) {
      return NextResponse.json({ error: "Base64 e mimeType são obrigatórios" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY não configurada no servidor" }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Você é um assistente de extração de dados para engenharia e controle financeiro.
Sua tarefa é analisar o orçamento/proposta anexa (planilha, imagem ou PDF) e extrair os dados gerais e os itens detalhados.
Se não encontrar uma informação, deixe o campo como null.

Retorne EXATAMENTE um objeto JSON válido, sem blocos de código markdown (sem \`\`\`json), no formato:
{
  "titulo": "Título do Orçamento ou Nome do Fornecedor",
  "valorTotal": 12345.67,
  "validadeDias": 15,
  "itens": [
    {
      "descricao": "Nome do Produto ou Serviço",
      "quantidade": 10.5,
      "valorUnitario": 100.00,
      "valorTotal": 1050.00
    }
  ]
}

Importante: O valor numérico deve usar o ponto como separador decimal.`;

    const imageParts = [
      {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    let jsonStr = responseText;
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "").trim();
    }

    try {
      const parsedData = JSON.parse(jsonStr);
      return NextResponse.json(parsedData);
    } catch (e) {
      console.error("Erro ao fazer parse do JSON do Gemini no Orçamento:", responseText);
      return NextResponse.json({ error: "A inteligência artificial não conseguiu processar o orçamento perfeitamente.", raw: responseText }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Erro no OCR Orçamento:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
