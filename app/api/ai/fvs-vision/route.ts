import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { verifyIdToken } from '@/lib/auth';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    
    const body = await request.json();
    const { imageBase64, mimeType, servico } = body;

    if (!imageBase64 || !servico) {
      return NextResponse.json({ success: false, error: 'Imagem ou serviço não informado' }, { status: 400 });
    }

    const prompt = `Você é um engenheiro civil especialista em controle de qualidade. 
O usuário enviou uma foto referente à Ficha de Verificação de Serviço (FVS) da etapa: "${servico}".
Analise a imagem e aponte:
1. Conformidades visíveis (o que está bom)
2. Não conformidades ou suspeitas de falhas (ex: trincas, falta de prumo, acabamento ruim, descolamento, umidade).
Responda em formato JSON, com duas listas de strings: "conformidades" e "naoConformidades". 
Não inclua crases no formato, responda somente o JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType || 'image/jpeg',
          }
        },
        prompt
      ],
    });

    const textoIA = response.text;
    let jsonParsed;
    
    try {
      jsonParsed = JSON.parse(textoIA.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch(e) {
      jsonParsed = { conformidades: ["Erro ao analisar"], naoConformidades: [textoIA] };
    }

    return NextResponse.json({ success: true, analise: jsonParsed }, { status: 200 });

  } catch (error: any) {
    console.error('Erro na AI FVS Vision:', error);
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
