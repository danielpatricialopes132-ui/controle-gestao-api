import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hoje = new Date();
    const daqui3Dias = new Date();
    daqui3Dias.setDate(hoje.getDate() + 3);

    // Buscar Receitas pendentes que estão atrasadas ou vencendo em até 3 dias
    const contasReceber = await prisma.transacaoFinanceira.findMany({
      where: {
        tipo: 'RECEITA',
        status: 'PENDENTE',
        dataVencimento: {
          lte: daqui3Dias
        },
        obra: {
          clienteId: { not: null }
        }
      },
      include: {
        obra: {
          include: {
            cliente: true
          }
        }
      }
    });

    const resultados = [];

    for (const conta of contasReceber) {
      const cliente = conta.obra?.cliente;
      if (!cliente || !cliente.telefone) continue;

      const diasAtraso = conta.dataVencimento ? Math.floor((hoje.getTime() - conta.dataVencimento.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      let situacao = "vai vencer em breve";
      if (diasAtraso > 0) {
        situacao = `está em atraso há ${diasAtraso} dias`;
      } else if (diasAtraso === 0) {
        situacao = "vence hoje";
      } else {
        situacao = `vence em ${Math.abs(diasAtraso)} dias`;
      }

      const prompt = `Atue como um assistente financeiro educado e gentil de uma construtora.
O cliente "${cliente.nome}" possui uma parcela/fatura no valor de R$ ${Number(conta.valor).toFixed(2)} referente à obra "${conta.obra?.nome}".
Esta fatura ${situacao} (data de vencimento: ${conta.dataVencimento?.toLocaleDateString('pt-BR')}).
Escreva uma mensagem de WhatsApp curta e amigável, lembrando-o gentilmente sobre o pagamento e se colocando à disposição em caso de dúvidas. Não use aspas.`;

      const result = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt
      });
      const mensagemIA = result.text;

      const celularFormatado = cliente.telefone.replace(/\D/g, '');
      const evolutionApiUrl = process.env.EVOLUTION_API_URL;
      const evolutionApiKey = process.env.EVOLUTION_API_KEY;
      const instanceName = process.env.EVOLUTION_INSTANCE;

      if (evolutionApiUrl && evolutionApiKey && instanceName) {
        try {
          await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey
            },
            body: JSON.stringify({
              number: `55${celularFormatado}`,
              text: mensagemIA
            })
          });
          resultados.push({ contaId: conta.id, status: 'enviado', mensagem: mensagemIA });
        } catch (err) {
          resultados.push({ contaId: conta.id, status: 'erro_envio', erro: err });
        }
      } else {
        resultados.push({ contaId: conta.id, status: 'simulado', mensagem: mensagemIA });
      }
    }

    return NextResponse.json({ success: true, disparos: resultados }, { status: 200 });
  } catch (error: any) {
    console.error('Erro no Agente de Cobrança Clientes:', error);
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
