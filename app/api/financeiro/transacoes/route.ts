import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    const tenantId = userAuth.tenantId;

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: { tenantId },
      include: {
        categoriaFk: { select: { descricao: true, nome: true } },
        obra: { select: { nome: true } },
        contaBancaria: { select: { nome: true } }
      },
      orderBy: { dataVencimento: 'desc' }
    });

    return NextResponse.json({ success: true, data: transacoes });
  } catch (error: any) {
    console.error('Erro em GET transacoes:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    
    if (!body.descricao || !body.tipo || !body.valor || !body.planoContaId || !body.dataVencimento) {
      return NextResponse.json({ success: false, error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    const transacao = await prisma.transacaoFinanceira.create({
      data: {
        descricao: body.descricao,
        tipo: body.tipo, // RECEITA ou DESPESA
        valor: parseFloat(body.valor),
        dataVencimento: body.dataVencimento, // Formato ISO 8601 string
        status: body.status || 'PENDENTE',
        categoriaId: body.categoriaId || body.planoContaId,
        obraId: body.obraId || null,
        clienteId: body.clienteId || null,
        funcionarioId: body.funcionarioId || null,
        contaBancariaId: body.contaBancariaId || null,
        codigoBarras: body.codigoBarras || null,
        observacao: body.observacao || null,
        comprovanteUrl: body.comprovanteUrl || null,
        tenantId: tenantId,
      }
    });

    return NextResponse.json({ success: true, data: transacao });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}


