import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(req);
    const tenantId = userAuth.tenantId;
    const body = await req.json();

    const { 
      tipo, 
      descricao, 
      valor, 
      categoriaId, 
      obraId, 
      contaBancariaId,
      status, 
      dataVencimento, 
      dataPagamento,
      codigoBarras,
      observacao 
    } = body;

    const transacao = await prisma.transacaoFinanceira.updateMany({
      where: {
        id: params.id,
        tenantId,
      },
      data: {
        tipo,
        descricao,
        valor: valor != null ? parseFloat(valor) : undefined,
        categoriaId: categoriaId || undefined,
        obraId,
        contaBancariaId,
        status,
        dataVencimento: dataVencimento ? new Date(dataVencimento) : undefined,
        dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined,
        codigoBarras,
        observacao,
        comprovanteUrl: body.comprovanteUrl !== undefined ? body.comprovanteUrl : undefined,
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
    const userAuth = await verifyIdToken(req);
    const tenantId = userAuth.tenantId;

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
