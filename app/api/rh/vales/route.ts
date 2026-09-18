import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const funcionarioId = searchParams.get('funcionarioId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 });
    }

    const filter: any = { tenantId, isAdiantamento: true };
    if (funcionarioId) {
      filter.funcionarioId = funcionarioId;
    }

    const vales = await prisma.transacaoFinanceira.findMany({
      where: filter,
      include: {
        funcionario: true,
        obra: true,
      },
      orderBy: { dataVencimento: 'desc' },
    });

    return NextResponse.json(vales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { tenantId, funcionarioId, obraId, valor, descricao, dataVencimento } = data;

    if (!tenantId || !funcionarioId || !obraId || !valor) {
      return NextResponse.json({ error: 'Dados incompletos para o vale' }, { status: 400 });
    }

    const vale = await prisma.transacaoFinanceira.create({
      data: {
        tenantId,
        obraId,
        funcionarioId,
        tipo: 'DESPESA',
        valor: parseFloat(valor),
        descricao: descricao || 'Adiantamento (Vale)',
        status: 'PAGO', // Considerando que vale já sai do caixa, ou pode ser PENDENTE, vou colocar PAGO como padrão para vales entregues
        dataPagamento: new Date(),
        dataVencimento: dataVencimento ? new Date(dataVencimento) : new Date(),
        isAdiantamento: true,
      },
      include: {
        funcionario: true,
      }
    });

    return NextResponse.json({ success: true, data: vale }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
