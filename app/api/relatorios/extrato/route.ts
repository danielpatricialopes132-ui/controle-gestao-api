import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const { searchParams } = new URL(request.url);
    
    const dataInicioStr = searchParams.get('dataInicio');
    const dataFimStr = searchParams.get('dataFim');
    const obraId = searchParams.get('obraId');
    
    if (!dataInicioStr || !dataFimStr) {
      return NextResponse.json({ success: false, error: 'dataInicio e dataFim são obrigatórios' }, { status: 400 });
    }

    const dataInicio = new Date(dataInicioStr);
    const dataFim = new Date(dataFimStr);
    // Ajustar para final do dia
    dataFim.setHours(23, 59, 59, 999);

    const tenantId = userAuth.tenantId;

    // 1. Calcular Saldo Inicial (todas as transações PAGAS antes da dataInicio)
    const transacoesAnteriores = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId,
        status: 'PAGO',
        dataPagamento: {
          lt: dataInicio
        },
        ...(obraId ? { obraId } : {})
      },
      select: {
        tipo: true,
        valor: true
      }
    });

    let saldoInicial = 0;
    for (const t of transacoesAnteriores) {
      const valor = Number(t.valor);
      if (t.tipo === 'RECEITA') saldoInicial += valor;
      else saldoInicial -= valor;
    }

    // 2. Buscar transações do período filtrado
    const transacoesPeriodo = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId,
        status: 'PAGO',
        dataPagamento: {
          gte: dataInicio,
          lte: dataFim
        },
        ...(obraId ? { obraId } : {})
      },
      orderBy: {
        dataPagamento: 'asc'
      },
      include: {
        obra: {
          select: { nome: true }
        }
      }
    });

    // 3. Calcular saldo progressivo
    let saldoAtual = saldoInicial;
    const extrato = transacoesPeriodo.map(t => {
      const valor = Number(t.valor);
      if (t.tipo === 'RECEITA') {
        saldoAtual += valor;
      } else {
        saldoAtual -= valor;
      }

      return {
        id: t.id,
        data: t.dataPagamento,
        descricao: t.descricao,
        categoria: t.categoria,
        obra: t.obra?.nome,
        tipo: t.tipo,
        valor: valor,
        saldoAcumulado: saldoAtual
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        saldoInicial,
        saldoFinal: saldoAtual,
        transacoes: extrato
      }
    });

  } catch (error: any) {
    console.error('Erro no Extrato Bancário API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

