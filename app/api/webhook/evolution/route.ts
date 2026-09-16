import { NextResponse } from 'next/server';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from 'process';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.event !== 'messages.upsert') return NextResponse.json({ status: 'ignored' }, { status: 200 });

    const message = body.data?.message;
    if (!message || message.key?.fromMe || message.key?.remoteJid?.includes('@g.us')) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
    if (!messageText) return NextResponse.json({ status: 'no_text' }, { status: 200 });

    const senderNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
    const senderName = message.pushName || 'Cliente';

    if (!env.GEMINI_API_KEY) {
      await sendWhatsAppText({ number: senderNumber, text: "Desculpe, meu sistema está offline no momento." });
      return NextResponse.json({ status: 'api_key_missing' }, { status: 200 });
    }

    const systemInstruction = `Você é um assistente virtual da JHOSTON TEC. Seja educado. Falando com: ${senderName}. Se não souber, diga que vai transferir.`;
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: systemInstruction + "\n\nMensagem: " + messageText }] }] });
    
    await sendWhatsAppText({ number: senderNumber, text: result.response.text() });
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

