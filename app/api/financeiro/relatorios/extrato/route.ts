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
    const contaBancariaId = searchParams.get('contaBancariaId');
    const dataInicioParam = searchParams.get('dataInicio');
    const dataFimParam = searchParams.get('dataFim');

    const tenantOverride = request.headers.get('x-tenant-override');
    const tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;

    let contasWhere: any = { tenantId };
    if (contaBancariaId && contaBancariaId !== 'todas') {
      contasWhere.id = contaBancariaId;
    }

    // Busca as contas para somar o saldo inicial base
    const contas = await prisma.contaBancaria.findMany({
      where: contasWhere,
    });

    let saldoInicialBase = 0;
    contas.forEach(c => {
      saldoInicialBase += Number(c.saldoInicial) || 0;
    });

    const contasIds = contas.map(c => c.id);

    // Se as datas não vierem preenchidas, assume-se o mês atual
    const hoje = new Date();
    const dataInicio = dataInicioParam ? new Date(dataInicioParam) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const dataFim = dataFimParam ? new Date(dataFimParam) : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

    // Transações ocorridas ANTES de dataInicio para calcular o saldo de abertura
    const aggResult = await prisma.transacaoFinanceira.groupBy({
      by: ['tipo'],
      _sum: { valor: true },
      where: {
        tenantId,
        contaBancariaId: { in: contasIds },
        dataPagamento: { lt: dataInicio },
        status: 'PAGO'
      }
    });

    let totalReceitas = 0;
    let totalDespesas = 0;
    for (const row of aggResult) {
      if (row.tipo === 'RECEITA') totalReceitas = Number(row._sum.valor || 0);
      if (row.tipo === 'DESPESA') totalDespesas = Number(row._sum.valor || 0);
    }

    let saldoAberturaPeriodo = saldoInicialBase + totalReceitas - totalDespesas;

    // Transações no período atual
    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId,
        contaBancariaId: { in: contasIds },
        dataPagamento: {
          gte: dataInicio,
          lte: dataFim
        },
        status: 'PAGO'
      },
      select: {
        id: true,
        dataPagamento: true,
        descricao: true,
        tipo: true,
        valor: true,
        categoria: true,
        categoriaFk: { select: { descricao: true } },
        contaBancaria: { select: { nome: true } }
      },
      orderBy: {
        dataPagamento: 'asc'
      }
    });

    // Calcula o saldo progressivo linha a linha
    let saldoProgressivoAtual = saldoAberturaPeriodo;
    const extrato = transacoes.map(t => {
      const valor = Number(t.valor);
      if (t.tipo === 'RECEITA') {
        saldoProgressivoAtual += valor;
      } else {
        saldoProgressivoAtual -= valor;
      }

      return {
        id: t.id,
        data: t.dataPagamento,
        descricao: t.descricao,
        categoria: t.categoriaFk?.descricao ?? t.categoria ?? 'Sem Categoria',
        conta: t.contaBancaria?.nome ?? 'Sem Conta',
        tipo: t.tipo,
        valor: valor,
        saldoProgressivo: saldoProgressivoAtual
      };
    });

    return NextResponse.json({
      saldoAberturaPeriodo,
      saldoFinalPeriodo: saldoProgressivoAtual,
      transacoes: extrato
    });

  } catch (error: any) {
    console.error('Erro ao gerar extrato bancário:', error);
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
