import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (!userAuth || !userAuth.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;

    const planos = await prisma.planoConta.findMany({
      where: { tenantId },
      orderBy: [
        { tipo: 'asc' },
        { nome: 'asc' }
      ]
    });

    return NextResponse.json({ success: true, data: planos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}


