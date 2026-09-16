import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);

    if (userAuth.role !== 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a MASTER.' }, { status: 403 });
    }

    const usuarios = await prisma.usuario.findMany({
      include: {
        tenant: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: usuarios });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

