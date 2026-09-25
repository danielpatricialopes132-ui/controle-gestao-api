import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { base64, mimeType, fileName } = body;

    if (!base64) {
      return NextResponse.json({ error: 'Arquivo base64 não fornecido' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Você é um especialista em conciliação bancária e análise contábil.
Sua missão é extrair TODAS as transações e movimentações financeiras deste extrato bancário em PDF ou imagem.

Ignore saldos iniciais, saldos finais, limites de cheque especial ou resumos totais. Extraia apenas as movimentações individuais (débitos, créditos, pix recebidos, pix enviados, tarifas, pagamentos, transferências, etc.).

Retorne EXATAMENTE um array JSON contendo objetos, sem blocos markdown ou explicações:
[
  {
    "id": "gerar um id único para a linha se não houver no extrato ex: PDF_01",
    "tipo": "RECEITA" ou "DESPESA",
    "valor": 123.45,
    "descricao": "Histórico / Descrição completa da transação",
    "data": "YYYY-MM-DDTHH:mm:ss.sssZ"
  }
]

Regras vitais:
1. "tipo": Débitos, pagamentos, saques, compras em cartão, pix enviados e tarifas são "DESPESA". Créditos, depósitos, estornos e pix recebidos são "RECEITA".
2. "valor": SEMPRE positivo em número decimal com ponto.
3. "data": Deve ser uma data ISO válida representando o dia do lançamento no extrato (considere o ano corrente se não estiver explícito).
4. Retorne apenas o array JSON válido sem quebras de código markdown (sem \`\`\`json).`;

    const pdfParts = [
      {
        inlineData: {
          data: base64,
          mimeType: mimeType || 'application/pdf',
        },
      },
    ];

    const result = await model.generateContent([prompt, ...pdfParts]);
    const responseText = result.response.text();

    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const transactions = JSON.parse(jsonStr);

    if (!Array.isArray(transactions)) {
      throw new Error('A resposta gerada não é uma lista de transações válida.');
    }

    // Normalizar itens
    const normalized = transactions.map((t: any, index: number) => {
      const valorNum = typeof t.valor === 'number' ? Math.abs(t.valor) : Math.abs(parseFloat(t.valor) || 0);
      let dataIso = new Date().toISOString();
      if (t.data) {
        const d = new Date(t.data);
        if (!isNaN(d.getTime())) {
          dataIso = d.toISOString();
        }
      }

      return {
        id: t.id ? String(t.id) : `PDF_TRN_${Date.now()}_${index}`,
        tipo: t.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA',
        valor: valorNum,
        descricao: t.descricao || 'Lançamento sem descrição',
        data: dataIso,
      };
    });

    return NextResponse.json({ success: true, transactions: normalized });
  } catch (error: any) {
    console.error('Erro ao processar extrato PDF com IA:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar extrato bancário' }, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
