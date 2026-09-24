import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const user = await verifyIdToken(request);
    
    const body = await request.json();
    const { clienteId } = body;

    if (!clienteId) {
      return NextResponse.json({ error: 'Falta o clienteId' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findFirst({
      where: {
        id: clienteId,
        tenantId: user.tenantId,
      },
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    let token = cliente.tokenPortal;
    
    // Se não tem token, gera um
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: { tokenPortal: token },
      });
    }

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
