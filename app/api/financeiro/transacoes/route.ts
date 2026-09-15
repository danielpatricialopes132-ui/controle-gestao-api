import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    if (userAuth.role === 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a Tenants.' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: { tenantId },
      include: {
        planoConta: { select: { nome: true } },
        obra: { select: { nome: true } }
      },
      orderBy: { dataVencimento: 'desc' }
    });

    return NextResponse.json({ success: true, data: transacoes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    if (userAuth.role === 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a Tenants.' }, { status: 403 });
    }

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
        planoContaId: body.planoContaId,
        obraId: body.obraId || null,
        clienteId: body.clienteId || null,
        funcionarioId: body.funcionarioId || null,
        tenantId: tenantId,
      }
    });

    return NextResponse.json({ success: true, data: transacao });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}
