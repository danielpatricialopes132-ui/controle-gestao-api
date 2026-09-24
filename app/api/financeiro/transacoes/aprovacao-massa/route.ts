import { NextResponse } from 'next/server';
import { verifyIdToken, checkRole, registrarLog } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    if (!checkRole(userAuth.role, ['MASTER'])) {
      return NextResponse.json({ success: false, error: 'Acesso negado: Apenas MASTER pode aprovar transações' }, { status: 403 });
    }

    const body = await request.json();
    const { transacoesIds, acao } = body; // acao: 'APROVADO' ou 'REJEITADO'

    if (!transacoesIds || !Array.isArray(transacoesIds) || !acao) {
      return NextResponse.json({ success: false, error: 'IDs das transações e ação são obrigatórios' }, { status: 400 });
    }

    if (!['APROVADO', 'REJEITADO'].includes(acao)) {
        return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
    }

    const updated = await prisma.transacaoFinanceira.updateMany({
      where: {
        id: { in: transacoesIds },
        tenantId: tenantId
      },
      data: {
        statusAprovacao: acao
      }
    });

    await registrarLog(userAuth.dbId, tenantId, 'APROVACAO_MASSA_FINANCEIRO', 'FINANCEIRO', {
      transacoesIds,
      acao,
      count: updated.count
    });

    return NextResponse.json({ success: true, count: updated.count, message: `${updated.count} transações atualizadas com sucesso.` });
  } catch (error: any) {
    console.error('Erro em aprovação em massa:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
