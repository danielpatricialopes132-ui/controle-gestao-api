import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    const tenantId = userAuth.tenantId;

    const { searchParams } = new URL(request.url);
    const dataInicioStr = searchParams.get('dataInicio');
    const dataFimStr = searchParams.get('dataFim');
    const contaBancariaId = searchParams.get('contaBancariaId');

    if (!dataInicioStr || !dataFimStr) {
      return NextResponse.json({ error: 'dataInicio e dataFim são obrigatórios' }, { status: 400 });
    }

    const dataInicio = new Date(dataInicioStr);
    const dataFim = new Date(dataFimStr);
    dataFim.setHours(23, 59, 59, 999);

    // Filter bases
    const tenantFilter = { tenantId };
    const contaFilter = contaBancariaId ? { contaBancariaId } : {};

    // 1. Obter saldo inicial de todas as contas aplicáveis
    const contasBancarias = await prisma.contaBancaria.findMany({
      where: {
        ...tenantFilter,
        ...contaFilter
      }
    });
    
    let saldoInicialContas = contasBancarias.reduce((acc: number, conta: any) => acc + Number(conta.saldoInicial), 0);

    // 2. Calcular entradas e saídas ANTERIORES à dataInicio
    const transacoesAnteriores = await prisma.transacaoFinanceira.findMany({
      where: {
        ...tenantFilter,
        ...contaFilter,
        dataVencimento: { lt: dataInicio },
        status: 'PAGO' // Apenas transações consolidadas afetam o livro caixa contábil
      }
    });

    let receitasAnteriores = 0;
    let despesasAnteriores = 0;

    transacoesAnteriores.forEach(t => {
      if (t.tipo === 'RECEITA') receitasAnteriores += Number(t.valor);
      if (t.tipo === 'DESPESA') despesasAnteriores += Number(t.valor);
    });

    const saldoAnterior = saldoInicialContas + receitasAnteriores - despesasAnteriores;

    // 3. Buscar transações do período
    const transacoesPeriodo = await prisma.transacaoFinanceira.findMany({
      where: {
        ...tenantFilter,
        ...contaFilter,
        dataVencimento: { gte: dataInicio, lte: dataFim },
        status: 'PAGO' // Apenas consolidadas
      },
      orderBy: { dataVencimento: 'asc' },
      include: {
        categoriaFk: true,
        contaBancaria: true,
      }
    });

    // 4. Calcular o saldo acumulado linha a linha
    let saldoAcumulado = saldoAnterior;
    const transacoesComSaldo = transacoesPeriodo.map(t => {
      if (t.tipo === 'RECEITA') saldoAcumulado += Number(t.valor);
      if (t.tipo === 'DESPESA') saldoAcumulado -= Number(t.valor);
      
      return {
        ...t,
        valorFormatado: Number(t.valor),
        saldoAcumulado: saldoAcumulado
      };
    });

    return NextResponse.json({
      saldoAnterior,
      saldoFinalPeriodo: saldoAcumulado,
      transacoes: transacoesComSaldo
    });

  } catch (error) {
    console.error('Erro ao gerar livro caixa:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
