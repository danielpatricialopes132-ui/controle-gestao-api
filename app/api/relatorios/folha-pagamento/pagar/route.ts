import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    const body = await request.json();
    const pagamentos = body.pagamentos; // Array of { funcionarioId, valor, descricao, obraId }

    if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
      return NextResponse.json({ success: false, error: 'Lista de pagamentos inválida' }, { status: 400 });
    }

    const criados = [];
    for (const p of pagamentos) {
      const transacao = await prisma.transacaoFinanceira.create({
        data: {
          tenantId,
          tipo: 'DESPESA',
          categoria: 'PESSOAL', // Fixed category for payroll
          descricao: p.descricao || 'Pagamento de Salário',
          valor: parseFloat(p.valor),
          status: 'PENDENTE', // Gerado como pendente para que o gestor possa dar baixa quando sair da conta
          funcionarioId: p.funcionarioId,
          obraId: p.obraId || null,
          dataVencimento: new Date(),
        }
      });
      criados.push(transacao);
    }

    return NextResponse.json({ success: true, data: criados });
  } catch (error: any) {
    console.error('Erro em POST folha-pagamento/pagar:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
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
