import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { verifyIdToken, registrarLog } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    const {
      fileBase64,
      mimeType = 'application/pdf',
      obraId,
      tipoProjeto = 'ESTRUTURAL_OU_GERAL',
      observacoes = '',
    } = body;

    if (!fileBase64) {
      return NextResponse.json(
        { success: false, error: 'Arquivo do projeto (PDF ou imagem) em base64 não informado.' },
        { status: 400 }
      );
    }

    const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64;

    const systemInstruction = `Você é um Engenheiro Orçamentista Sênior e Especialista em Suprimentos de Construção Civil brasileira.
Sua missão é inspecionar o arquivo de projeto/prancha (PDF ou imagem) e extrair a lista quantitativa de materiais de construção e insumos necessários.

Padronizações obrigatórias:
- Aço/Vergalhão: extrair em "kg" ou "barra"
- Cimento: extrair em "saco 50kg"
- Areia e Brita: extrair em "m³"
- Blocos/Tijolos: extrair em "unidade" ou "milheiro"
- Concreto usinado: extrair em "m³"
- Tubos/Conexões/Fios: especificar metragem e bitola
- Tinta/Impermeabilizante: "balde 18L" ou "galão 3.6L"

Retorne ESTRITAMENTE um objeto JSON válido (sem crases nem formatação markdown) no seguinte formato:
{
  "resumoProjeto": "Breve resumo do que foi identificado na prancha (área, escopo, elementos estruturais)",
  "itens": [
    {
      "nome": "Nome padronizado do material/insumo",
      "categoria": "ESTRUTURA" | "ALVENARIA" | "HIDRAULICA" | "ELETRICA" | "ACABAMENTO" | "PINTURA" | "OUTROS",
      "quantidade": 100.5,
      "unidade": "saco 50kg" | "kg" | "m³" | "un" | "m",
      "observacaoTecnica": "Ex: CA-50 10mm para armadura positiva da viga V1"
    }
  ]
}`;

    const prompt = `Analise a prancha/projeto anexo e extraia a tabela completa de quantitativos de materiais. 
Tipo de Projeto: ${tipoProjeto}. 
Instruções adicionais do engenheiro: ${observacoes || 'Nenhuma'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || 'application/pdf',
          },
        },
        prompt,
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const textoIA = response.text || '{}';
    let jsonParsed: any = {};

    try {
      jsonParsed = JSON.parse(textoIA.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
      jsonParsed = {
        resumoProjeto: 'Identificação concluída',
        itens: [],
        raw: textoIA,
      };
    }

    await registrarLog(userAuth.dbId, tenantId, 'EXTRACAO_QUANTITATIVO_IA', 'ENGENHARIA_IA', {
      obraId: obraId || null,
      tipoProjeto,
      totalItensExtraidos: jsonParsed?.itens?.length || 0,
    });

    return NextResponse.json({
      success: true,
      data: jsonParsed,
    });
  } catch (error: any) {
    console.error('Erro na rota de quantitativos com IA:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
