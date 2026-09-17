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
      funcionarioId,
      valor,
      tipo,
      dataRecebimento,
      status
    } = body;

    const vale = await prisma.vale.updateMany({
      where: {
        id: params.id,
        tenantId,
      },
      data: {
        funcionarioId,
        valor: valor ? Number(valor) : undefined,
        tipo,
        dataRecebimento: dataRecebimento ? new Date(dataRecebimento) : undefined,
        status,
      },
    });

    if (vale.count === 0) {
      return NextResponse.json({ error: 'Vale não encontrado ou não pertence a este tenant.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em PUT vale:', error);
    return NextResponse.json({ error: 'Erro ao atualizar vale', details: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(req);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const tenantId = userAuth.tenantId;

    const vale = await prisma.vale.deleteMany({
      where: {
        id: params.id,
        tenantId,
      },
    });

    if (vale.count === 0) {
      return NextResponse.json({ error: 'Vale não encontrado ou não pertence a este tenant.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em DELETE vale:', error);
    return NextResponse.json({ error: 'Erro ao excluir vale', details: error.message }, { status: 500 });
  }
}
