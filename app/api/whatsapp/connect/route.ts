import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { connectEvolutionInstance, getEvolutionConnectionState } from '../../../../lib/whatsapp';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);

    if (userAuth.role !== 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a MASTER.' }, { status: 403 });
    }

    // 1. Verifica estado atual
    const connectionState = await getEvolutionConnectionState();
    
    if (connectionState.state === 'open') {
      return NextResponse.json({ success: true, state: 'open' });
    } else {
      // 2. Tenta conectar para obter o QR Code
      const qrData = await connectEvolutionInstance();
      return NextResponse.json({ success: true, state: 'connecting', qrData });
    }
  } catch (error: any) {
    console.error('Erro ao conectar whatsapp:', error);
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
