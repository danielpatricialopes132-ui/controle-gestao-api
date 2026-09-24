import { NextResponse } from 'next/server';
import { verifyIdToken, checkRole, registrarLog } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    const tenantId = userAuth.tenantId;
    const url = new URL(request.url);
    const statusAprovacao = url.searchParams.get('statusAprovacao');

    const whereClause: any = { tenantId };
    if (statusAprovacao) {
      whereClause.statusAprovacao = statusAprovacao;
    }

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: whereClause,
      include: {
        categoriaFk: { select: { descricao: true } },
        obra: { select: { nome: true } },
        contaBancaria: { select: { nome: true } },
        funcionario: { select: { id: true, nome: true, cargo: true } },
        rateios: {
          include: {
            obra: { select: { nome: true } },
            categoria: { select: { descricao: true } }
          }
        }
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

    if (!checkRole(userAuth.role, ['FINANCEIRO', 'MASTER'])) {
      return NextResponse.json({ success: false, error: 'Acesso negado: Perfil insuficiente' }, { status: 403 });
    }

    const body = await request.json();
    
    if (!body.descricao || !body.tipo || !body.valor || !body.planoContaId || !body.dataVencimento) {
      return NextResponse.json({ success: false, error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    const dataTransacao: any = {
      descricao: body.descricao,
      tipo: body.tipo, // RECEITA ou DESPESA
      valor: parseFloat(body.valor),
      dataVencimento: body.dataVencimento, // Formato ISO 8601 string
      status: body.status || 'PENDENTE',
      categoriaId: body.categoriaId || body.planoContaId,
      obraId: body.obraId || null,
      clienteFornecedor: body.clienteId || body.clienteFornecedor || null,
      funcionarioId: body.funcionarioId || null,
      contaBancariaId: body.contaBancariaId || null,
      codigoBarras: body.codigoBarras || null,
      observacao: body.observacao || null,
      comprovanteUrl: body.comprovanteUrl || null,
      tenantId: tenantId,
    };

    if (body.rateios && Array.isArray(body.rateios) && body.rateios.length > 0) {
      dataTransacao.rateios = {
        create: body.rateios.map((r: any) => ({
          obraId: r.obraId || null,
          categoriaId: r.categoriaId || null,
          valor: parseFloat(r.valor),
          percentual: r.percentual ? parseFloat(r.percentual) : null,
          observacao: r.observacao || null
        }))
      };
    }

    const transacao = await prisma.transacaoFinanceira.create({
      data: dataTransacao,
      include: { rateios: true }
    });

    await registrarLog(userAuth.dbId, tenantId, 'CRIAR_TRANSACAO', 'FINANCEIRO', {
      transacaoId: transacao.id,
      descricao: transacao.descricao,
      valor: transacao.valor
    });

    return NextResponse.json({ success: true, data: transacao });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
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
