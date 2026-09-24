import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const { transacaoId, ofxId, data } = await request.json();

    if (!transacaoId || !ofxId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const transacaoAtualizada = await prisma.transacaoFinanceira.update({
      where: {
        id: transacaoId,
        tenantId,
      },
      data: {
        isConciliada: true,
        ofxId: ofxId,
        status: 'PAGO',
        dataPagamento: data ? new Date(data) : new Date()
      },
    });

    return NextResponse.json(transacaoAtualizada);
  } catch (error) {
    console.error('Error in conciliation:', error);
    return NextResponse.json({ error: 'Failed to conciliate transaction' }, { status: 500 });
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
