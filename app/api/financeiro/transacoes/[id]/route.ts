import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '@/lib/firebase-admin';

initAdmin();

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    let usuario = await prisma.usuario.findUnique({
      where: { firebaseUid: decodedToken.uid },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const tenantId = usuario.tenantId;
    const body = await req.json();

    const { 
      tipo, 
      descricao, 
      valor, 
      categoriaFkId, 
      obraId, 
      status, 
      dataVencimento, 
      dataPagamento 
    } = body;

    const transacao = await prisma.transacaoFinanceira.updateMany({
      where: {
        id: params.id,
        tenantId,
      },
      data: {
        tipo,
        descricao,
        valor,
        categoriaFkId,
        obraId,
        status,
        dataVencimento: dataVencimento ? new Date(dataVencimento) : undefined,
        dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined,
      },
    });

    if (transacao.count === 0) {
      return NextResponse.json({ error: 'Transação não encontrada ou não pertence a este tenant.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em PUT transacao:', error);
    return NextResponse.json({ error: 'Erro ao atualizar transação', details: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    let usuario = await prisma.usuario.findUnique({
      where: { firebaseUid: decodedToken.uid },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const tenantId = usuario.tenantId;

    const transacao = await prisma.transacaoFinanceira.deleteMany({
      where: {
        id: params.id,
        tenantId,
      },
    });

    if (transacao.count === 0) {
      return NextResponse.json({ error: 'Transação não encontrada ou não pertence a este tenant.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em DELETE transacao:', error);
    return NextResponse.json({ error: 'Erro ao excluir transação', details: error.message }, { status: 500 });
  }
}
