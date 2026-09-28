import { NextResponse } from 'next/server';
import { sendWhatsAppFile } from '../../../../lib/whatsapp';

export async function POST(request: Request) {
  try {
    const { numero, base64, fileName, caption } = await request.json();

    if (!numero || !base64 || !fileName) {
      return NextResponse.json({ error: 'Número, base64 e nome do arquivo são obrigatórios' }, { status: 400 });
    }

    await sendWhatsAppFile({
      number: numero,
      base64,
      fileName,
      caption: caption || 'Segue o relatório em anexo.'
    });

    return NextResponse.json({ success: true, message: 'Arquivo enviado com sucesso!' }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    });
  } catch (error: any) {
    console.error('Erro ao enviar PDF via WhatsApp:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar arquivo', details: error?.message || String(error) },
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
