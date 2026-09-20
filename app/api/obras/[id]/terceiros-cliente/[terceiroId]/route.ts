import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; terceiroId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId, terceiroId } = await params;
    const body = await request.json();

    const atualizado = await prisma.terceiroCliente.updateMany({
      where: {
        id: terceiroId,
        obraId,
        tenantId: userAuth.tenantId,
      },
      data: {
        status: body.status,
        responsavel: body.responsavel,
        telefone: body.telefone,
        email: body.email,
        observacoes: body.observacoes,
        dataPrevisaoInicio: body.dataPrevisaoInicio ? new Date(body.dataPrevisaoInicio) : undefined,
        dataPrevisaoFim: body.dataPrevisaoFim ? new Date(body.dataPrevisaoFim) : undefined,
      }
    });

    return NextResponse.json({ success: true, count: atualizado.count });
  } catch (error: any) {
    console.error('Erro ao atualizar terceiro do cliente:', error);
    return NextResponse.json({ error: 'Erro ao atualizar terceiro' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; terceiroId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId, terceiroId } = await params;

    await prisma.terceiroCliente.deleteMany({
      where: {
        id: terceiroId,
        obraId,
        tenantId: userAuth.tenantId,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao excluir terceiro do cliente:', error);
    return NextResponse.json({ error: 'Erro ao excluir empresa parceira' }, { status: 500 });
  }
}
