import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId, itemId } = await params;
    const body = await request.json();

    const atualizado = await prisma.punchListItem.updateMany({
      where: {
        id: itemId,
        obraId,
        tenantId: userAuth.tenantId,
      },
      data: {
        status: body.status,
        dataResolucao: body.status === 'RESOLVIDO' ? new Date() : null,
        descricao: body.descricao,
        prazoCorrecao: body.prazoCorrecao ? new Date(body.prazoCorrecao) : undefined,
      }
    });

    return NextResponse.json({ success: true, count: atualizado.count });
  } catch (error: any) {
    console.error('Erro ao atualizar item do punch list:', error);
    return NextResponse.json({ error: 'Erro ao atualizar pendência' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId, itemId } = await params;

    await prisma.punchListItem.deleteMany({
      where: {
        id: itemId,
        obraId,
        tenantId: userAuth.tenantId,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao excluir item do punch list:', error);
    return NextResponse.json({ error: 'Erro ao excluir pendência' }, { status: 500 });
  }
}
