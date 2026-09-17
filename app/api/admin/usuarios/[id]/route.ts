import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, context: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(request);

    if (userAuth.role !== 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a MASTER.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const updatedUser = await prisma.usuario.update({
      where: { id },
      data: {
        status: body.status !== undefined ? body.status : undefined, // ATIVO, PENDENTE, BLOQUEADO
        tenantId: body.tenantId !== undefined ? body.tenantId : undefined, // Vínculo com a empresa
        role: body.role !== undefined ? body.role : undefined, // USER, ADMIN, etc (dentro da empresa)
        telefone: body.telefone !== undefined ? body.telefone : undefined, // WhatsApp number
      }
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
