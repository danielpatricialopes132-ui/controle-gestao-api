import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(req);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const tenantId = userAuth.tenantId;
    const body = await req.json();

    const { 
      nome,
      funcao,
      tipoPagamento,
      valorPadrao
    } = body;

    const funcionario = await prisma.funcionario.updateMany({
      where: {
        id: params.id,
        tenantId,
      },
      data: {
        nome,
        funcao,
        tipoPagamento,
        valorPadrao: valorPadrao ? Number(valorPadrao) : undefined,
      },
    });

    if (funcionario.count === 0) {
      return NextResponse.json({ error: 'Funcionário não encontrado ou não pertence a este tenant.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em PUT funcionario:', error);
    return NextResponse.json({ error: 'Erro ao atualizar funcionário', details: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(req);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const tenantId = userAuth.tenantId;

    const funcionario = await prisma.funcionario.deleteMany({
      where: {
        id: params.id,
        tenantId,
      },
    });

    if (funcionario.count === 0) {
      return NextResponse.json({ error: 'Funcionário não encontrado ou não pertence a este tenant.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em DELETE funcionario:', error);
    return NextResponse.json({ error: 'Erro ao excluir funcionário', details: error.message }, { status: 500 });
  }
}
