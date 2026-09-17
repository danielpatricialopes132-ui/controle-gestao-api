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
    const body = await request.json();
    const { nome, banco, agencia, conta, saldoInicial, isAtiva } = body;

    const existente = await prisma.contaBancaria.findUnique({
      where: { id, tenantId: userAuth.tenantId }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Conta bancária não encontrada' }, { status: 404 });
    }

    const atualizada = await prisma.contaBancaria.update({
      where: { id },
      data: {
        nome: nome ?? existente.nome,
        banco: banco ?? existente.banco,
        agencia: agencia ?? existente.agencia,
        conta: conta ?? existente.conta,
        saldoInicial: saldoInicial ? Number(saldoInicial) : existente.saldoInicial,
        isAtiva: isAtiva ?? existente.isAtiva
      }
    });

    return NextResponse.json(atualizada);
  } catch (error: any) {
    console.error('Erro ao atualizar conta bancária:', error);
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

    const existente = await prisma.contaBancaria.findUnique({
      where: { id, tenantId: userAuth.tenantId },
      include: {
        _count: {
          select: { transacoes: true }
        }
      }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Conta bancária não encontrada' }, { status: 404 });
    }

    if (existente._count.transacoes > 0) {
      return NextResponse.json({ error: 'Não é possível excluir conta bancária com transações vinculadas.' }, { status: 400 });
    }

    await prisma.contaBancaria.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar conta bancária:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
