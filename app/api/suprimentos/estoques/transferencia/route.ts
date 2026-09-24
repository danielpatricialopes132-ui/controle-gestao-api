import { NextResponse } from 'next/server';
import { verifyIdToken, checkRole, registrarLog } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    if (!checkRole(userAuth.role, ['SUPRIMENTOS', 'MASTER', 'ENGENHEIRO'])) {
      return NextResponse.json({ success: false, error: 'Acesso negado: Perfil insuficiente' }, { status: 403 });
    }

    const body = await request.json();
    const { fromEstoqueId, toEstoqueId, produtoId, quantidade } = body;

    if (!fromEstoqueId || !toEstoqueId || !produtoId || !quantidade || quantidade <= 0) {
      return NextResponse.json({ success: false, error: 'Dados inválidos para transferência' }, { status: 400 });
    }

    if (fromEstoqueId === toEstoqueId) {
      return NextResponse.json({ success: false, error: 'Estoque de origem e destino não podem ser os mesmos' }, { status: 400 });
    }

    // Usar transação Prisma para garantir integridade
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar estoque de origem
      const sourceItem = await tx.estoqueItem.findUnique({
        where: { estoqueId_produtoId: { estoqueId: fromEstoqueId, produtoId: produtoId } }
      });

      if (!sourceItem || Number(sourceItem.quantidade) < quantidade) {
        throw new Error('Quantidade insuficiente no estoque de origem.');
      }

      // 2. Descontar do estoque de origem
      await tx.estoqueItem.update({
        where: { id: sourceItem.id },
        data: { quantidade: { decrement: quantidade } }
      });

      // 3. Adicionar ao estoque de destino
      const destItem = await tx.estoqueItem.findUnique({
        where: { estoqueId_produtoId: { estoqueId: toEstoqueId, produtoId: produtoId } }
      });

      if (destItem) {
        await tx.estoqueItem.update({
          where: { id: destItem.id },
          data: { quantidade: { increment: quantidade } }
        });
      } else {
        await tx.estoqueItem.create({
          data: {
            estoqueId: toEstoqueId,
            produtoId: produtoId,
            quantidade: quantidade,
            tenantId: tenantId
          }
        });
      }

      return true;
    });

    await registrarLog(userAuth.dbId, tenantId, 'TRANSFERENCIA_ESTOQUE', 'SUPRIMENTOS', {
      fromEstoqueId,
      toEstoqueId,
      produtoId,
      quantidade
    });

    return NextResponse.json({ success: true, message: 'Transferência realizada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao transferir estoque:', error);
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
