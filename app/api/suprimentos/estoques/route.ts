import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = userAuth.tenantId;

    const estoques = await prisma.estoque.findMany({
      where: { tenantId },
      include: {
        obra: true,
        _count: {
          select: { itens: true }
        }
      },
      orderBy: { nome: 'asc' }
    });

    return NextResponse.json({ success: true, data: estoques });
  } catch (error: any) {
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
