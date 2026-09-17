import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyIdToken } from '@/lib/auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    if (userAuth.role !== 'MASTER') {
      return NextResponse.json({ error: 'Acesso restrito ao perfil MASTER' }, { status: 403 });
    }

    const { prompt, history } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave da API não configurada' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const chat = model.startChat({
      history: history || [],
      systemInstruction: 'Você é um assistente virtual especialista no sistema de Controle de Gestão da Jhoston Tec. Responda de forma clara, prestativa e profissional. O usuário logado é um MASTER (Administrador Supremo). Você pode dar dicas financeiras, de obras ou ajudar a entender os relatórios do sistema.',
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ response: text });
  } catch (error: any) {
    console.error('Erro no chat Gemini:', error);
    return NextResponse.json({ error: 'Erro interno no servidor de IA' }, { status: 500 });
  }
}
