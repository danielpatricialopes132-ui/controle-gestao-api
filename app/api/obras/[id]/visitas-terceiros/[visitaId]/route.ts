import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

// DELETE: Remove uma visita registrada
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; visitaId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId, visitaId } = await params;

    const visita = await prisma.visitaTerceiroCliente.findFirst({
      where: { id: visitaId, obraId, tenantId: userAuth.tenantId },
    });

    if (!visita) {
      return NextResponse.json({ error: 'Visita não encontrada.' }, { status: 404 });
    }

    await prisma.visitaTerceiroCliente.delete({
      where: { id: visitaId },
    });

    return NextResponse.json({ success: true, message: 'Visita removida com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao deletar visita de terceiro:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
