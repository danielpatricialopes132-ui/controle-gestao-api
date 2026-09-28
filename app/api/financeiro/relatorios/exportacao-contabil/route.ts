import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dataInicioParam = searchParams.get('dataInicio');
    const dataFimParam = searchParams.get('dataFim');

    const tenantOverride = request.headers.get('x-tenant-override');
    const tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;

    const hoje = new Date();
    const dataInicio = dataInicioParam ? new Date(dataInicioParam) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const dataFim = dataFimParam ? new Date(dataFimParam) : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId,
        dataPagamento: {
          gte: dataInicio,
          lte: dataFim
        },
        status: 'PAGO' // Contabilidade só recebe o que foi efetivamente pago/recebido
      },
      select: {
        id: true,
        dataPagamento: true,
        descricao: true,
        clienteFornecedor: true,
        tipo: true,
        valor: true,
        categoria: true,
        isConciliada: true,
        formaPagamento: true,
        categoriaFk: { select: { descricao: true } },
        contaBancaria: { select: { nome: true } },
        obra: { select: { nome: true } },
        funcionario: { select: { nome: true } }
      },
      orderBy: {
        dataPagamento: 'asc'
      }
    });

    const exportData = transacoes.map(t => {
      let beneficiario = t.clienteFornecedor || '';
      if (!beneficiario && t.funcionario) {
        beneficiario = t.funcionario.nome;
      }

      return {
        id: t.id,
        data: t.dataPagamento?.toISOString() || null,
        descricao: t.descricao || '',
        beneficiario: beneficiario,
        obra: t.obra?.nome || 'Geral / Administrativo',
        categoria: t.categoriaFk?.descricao ?? t.categoria ?? 'Sem Categoria',
        contaBancaria: t.contaBancaria?.nome ?? 'Sem Conta',
        formaPagamento: t.formaPagamento || 'Outros',
        tipo: t.tipo,
        valor: Number(t.valor),
        statusConciliacao: t.isConciliada ? 'Conciliado' : 'Não Conciliado'
      };
    });

    return NextResponse.json({
      total: exportData.length,
      transacoes: exportData
    });

  } catch (error: any) {
    console.error('Erro ao exportar dados contábeis:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
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
