import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken, registrarLog } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userAuth = await verifyIdToken(req);
    const tenantId = userAuth.tenantId;
    const { id } = await params;
    const body = await req.json();

    const transacaoAnterior = await prisma.transacaoFinanceira.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!transacaoAnterior) {
      return NextResponse.json({ error: 'Transação não encontrada ou não pertence a este tenant.' }, { status: 404 });
    }

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

    const transacao = await prisma.transacaoFinanceira.update({
      where: {
        id: id,
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
        funcionarioId: body.funcionarioId !== undefined ? body.funcionarioId : undefined,
        clienteFornecedor: body.clienteFornecedor !== undefined ? body.clienteFornecedor : undefined,
      },
    });

    await registrarLog(userAuth.dbId, tenantId, 'EDITAR_TRANSACAO', 'FINANCEIRO', {
      transacaoId: id,
      descricao: transacaoAnterior.descricao,
      valoresAnteriores: {
        tipo: transacaoAnterior.tipo,
        descricao: transacaoAnterior.descricao,
        valor: transacaoAnterior.valor,
        status: transacaoAnterior.status,
        dataVencimento: transacaoAnterior.dataVencimento,
        dataPagamento: transacaoAnterior.dataPagamento,
      },
      valoresNovos: {
        tipo,
        descricao,
        valor: valor != null ? parseFloat(valor) : undefined,
        status,
        dataVencimento,
        dataPagamento,
      }
    });

    return NextResponse.json({ success: true, data: transacao });
  } catch (error: any) {
    console.error('Erro em PUT transacao:', error);
    return NextResponse.json({ error: 'Erro ao atualizar transação', details: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userAuth = await verifyIdToken(req);
    const tenantId = userAuth.tenantId;
    const { id } = await params;

    const transacaoExistente = await prisma.transacaoFinanceira.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!transacaoExistente) {
      return NextResponse.json({ error: 'Transação não encontrada ou não pertence a este tenant.' }, { status: 404 });
    }

    await prisma.transacaoFinanceira.delete({
      where: {
        id,
      },
    });

    await registrarLog(userAuth.dbId, tenantId, 'EXCLUIR_TRANSACAO', 'FINANCEIRO', {
      transacaoId: id,
      descricao: transacaoExistente.descricao,
      valor: transacaoExistente.valor,
      tipo: transacaoExistente.tipo,
      status: transacaoExistente.status,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em DELETE transacao:', error);
    return NextResponse.json({ error: 'Erro ao excluir transação', details: error.message }, { status: 500 });
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
