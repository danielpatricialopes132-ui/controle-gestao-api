import { NextResponse } from 'next/server';
import { sendWhatsAppText } from '../../../../../../lib/whatsapp';

export async function POST(request: Request) {
  try {
    const { numero, url } = await request.json();

    if (!numero || !url) {
      return NextResponse.json({ error: 'Número e URL são obrigatórios' }, { status: 400 });
    }

    const msg = `Olá! Existem despesas que precisam da sua justificativa.\nPor favor, acesse o link abaixo para preencher direto do celular:\n\n${url}`;

    await sendWhatsAppText({
      number: numero,
      text: msg,
    });

    return NextResponse.json({ success: true, message: 'Notificação enviada com sucesso!' }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    });
  } catch (error: any) {
    console.error('Erro ao notificar via WhatsApp:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar notificação', details: error?.message || String(error) },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      }
    );
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
