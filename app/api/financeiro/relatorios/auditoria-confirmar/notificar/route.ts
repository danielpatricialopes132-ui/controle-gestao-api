import { NextResponse } from 'next/server';
import { sendWhatsAppText } from '../../../../../../lib/whatsapp';

export async function POST(request: Request) {
  try {
    // 1. Verifica autenticação
    const { verifyIdToken } = await import('@/lib/auth');
    const userAuth = await verifyIdToken(request);
    
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const tenantOverride = request.headers.get('x-tenant-override');
    const tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;

    const { numero, url: fallbackUrl } = await request.json();

    if (!numero) {
      return NextResponse.json({ error: 'Número é obrigatório' }, { status: 400 });
    }

    // 2. Gera URL do portal
    const tenantIdBase64 = Buffer.from(tenantId).toString('base64');
    
    // Obtém o host dinamicamente para gerar o link do portal
    const host = request.headers.get('host') || 'controle-gestao-api.onrender.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const url = `${protocol}://${host}/portal/auditoria/${tenantIdBase64}`;

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
