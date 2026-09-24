import { NextResponse } from 'next/server';
import { verifyIdToken, checkRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    if (!checkRole(userAuth.role, ['MASTER', 'FINANCEIRO'])) {
      return NextResponse.json({ error: 'Acesso negado: Perfil insuficiente para previsão de IA' }, { status: 403 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor' }, { status: 500 });
    }

    // Calcular data limite (3 meses atrás até 3 meses no futuro)
    const dataAtual = new Date();
    const dataInicio = new Date();
    dataInicio.setMonth(dataAtual.getMonth() - 3);
    const dataFim = new Date();
    dataFim.setMonth(dataAtual.getMonth() + 3);

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId,
        dataVencimento: {
          gte: dataInicio.toISOString(),
          lte: dataFim.toISOString(),
        }
      },
      select: {
        tipo: true,
        valor: true,
        dataVencimento: true,
        status: true,
        categoriaFk: { select: { descricao: true } }
      }
    });

    // Mapeando dados para a IA para não estourar o contexto
    const dadosSimplificados = transacoes.map(t => ({
      tipo: t.tipo, // RECEITA ou DESPESA
      valor: t.valor,
      data: t.dataVencimento.split('T')[0],
      status: t.status,
      categoria: t.categoriaFk?.descricao || 'Diversos'
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Você atua como um CFO Analista Financeiro e Especialista em Fluxo de Caixa.
Abaixo está a lista das transações (Receitas e Despesas) da nossa empresa dos últimos 3 meses e previsões de vencimento dos próximos 3 meses.

Sua tarefa é analisar os padrões de gastos, calcular o saldo de cada mês e gerar uma previsão estratégica de fluxo de caixa para os próximos meses.
Destaque os meses com maior risco de falta de caixa (gargalos).

Retorne EXATAMENTE um objeto JSON válido (sem tags markdown de bloco de código) com a seguinte estrutura:
{
  "analiseGeral": "Texto com o panorama geral da empresa e conselhos de CFO.",
  "gargalos": ["Alerta 1", "Alerta 2"],
  "meses": [
    {
      "mes": "Ano-Mês (ex: 2024-10)",
      "receitasPrevistas": 15000.00,
      "despesasPrevistas": 12000.00,
      "saldoPrevisto": 3000.00,
      "risco": "Baixo" // Pode ser Baixo, Médio, Alto
    }
  ]
}

Dados das transações:
${JSON.stringify(dadosSimplificados)}
`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // Limpar marcação markdown caso a IA inclua
    if (responseText.startsWith("```json")) {
      responseText = responseText.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsedData = JSON.parse(responseText);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Erro na previsão IA:', error);
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
