import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function GET(request: Request) {
  try {
    // Autenticação de CRON Job via token Bearer (Header)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hoje = new Date();
    const daqui3Dias = new Date();
    daqui3Dias.setDate(hoje.getDate() + 3);

    // Buscar Termos de Retirada (Cautelas) que vencem em 3 dias
    const termosVencendo = await prisma.termoRetiradaItem.findMany({
      where: {
        status: 'RETIRADO',
        previsaoDevolucao: {
          gte: hoje,
          lte: daqui3Dias
        }
      },
      include: {
        obra: true,
        terceiro: true
      }
    });

    const resultados = [];

    for (const termo of termosVencendo) {
      if (!termo.terceiro?.telefone) continue;

      // Gerar mensagem com IA
      const prompt = `Atue como um Agente de Cobrança Proativo de uma construtora. 
O fornecedor/parceiro "${termo.terceiro.nomeEmpresa}" retirou itens da obra "${termo.obra?.nome}" (Motivo: ${termo.motivoRetirada}) no dia ${termo.dataRetirada.toLocaleDateString('pt-BR')}.
O prazo de devolução está previsto para ${termo.previsaoDevolucao?.toLocaleDateString('pt-BR')}.
Escreva uma mensagem curta de WhatsApp, educada mas firme, lembrando o fornecedor do prazo de entrega que se aproxima em menos de 3 dias, pedindo que confirme se está tudo certo.
Apenas retorne o texto da mensagem, sem aspas, pronto para ser enviado.`;

      const result = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt
      });
      const mensagemIA = result.text;

      // Enviar via Evolution API (WhatsApp)
      const celularFormatado = termo.terceiro.telefone.replace(/\D/g, '');
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
          resultados.push({ termoId: termo.id, status: 'enviado', mensagem: mensagemIA });
        } catch (err) {
          resultados.push({ termoId: termo.id, status: 'erro_envio', erro: err });
        }
      } else {
        resultados.push({ termoId: termo.id, status: 'simulado', mensagem: mensagemIA });
      }
    }

    return NextResponse.json({ success: true, disparos: resultados }, { status: 200 });

  } catch (error: any) {
    console.error('Erro no Agente de Cobrança:', error);
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
