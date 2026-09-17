import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { id } = params;
    const { codigo, descricao, tipo, isAtiva } = await request.json();

    const categoria = await prisma.categoriaFinanceira.findUnique({ where: { id } });
    if (!categoria || categoria.tenantId !== userAuth.tenantId) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    }

    const atualizada = await prisma.categoriaFinanceira.update({
      where: { id },
      data: {
        codigo: codigo ?? categoria.codigo,
        descricao: descricao ?? categoria.descricao,
        tipo: tipo ?? categoria.tipo,
        isAtiva: isAtiva ?? categoria.isAtiva,
      }
    });

    return NextResponse.json(atualizada);
  } catch (error: any) {
    console.error('Erro ao atualizar categoria financeira:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { id } = params;

    const categoria = await prisma.categoriaFinanceira.findUnique({ where: { id } });
    if (!categoria || categoria.tenantId !== userAuth.tenantId) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    }

    await prisma.categoriaFinanceira.delete({ where: { id } });
    return NextResponse.json({ message: 'Excluída com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir categoria financeira:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
