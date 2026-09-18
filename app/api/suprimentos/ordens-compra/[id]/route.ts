import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken, checkRole, registrarLog } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const { id } = await params;
    const data = await request.json();

    // Busca a ordem original para checar status anterior
    const ordemOriginal = await prisma.ordemCompra.findUnique({
      where: { id, tenantId },
      include: { fornecedor: true, obra: true },
    });

    if (!ordemOriginal) {
      return NextResponse.json({ error: "Ordem não encontrada" }, { status: 404 });
    }

    const newStatus = data.status;
    let transacaoId = ordemOriginal.transacaoId;

    // 1. Regra Financeira: Lançar despesa quando APROVADA
    if (newStatus === "APROVADA" && ordemOriginal.status !== "APROVADA" && !transacaoId) {
      if (!checkRole(userAuth.role, ['MASTER', 'FINANCEIRO'])) {
        return NextResponse.json({ success: false, error: 'Acesso negado: Apenas o Financeiro ou Master pode aprovar OC.' }, { status: 403 });
      }

      const novaTransacao = await prisma.transacaoFinanceira.create({
        data: {
          tipo: "DESPESA",
          valor: ordemOriginal.valorTotal,
          descricao: `Compra de Materiais (OC #${ordemOriginal.numero}) - ${ordemOriginal.fornecedor.nome}`,
          status: "PENDENTE",
          dataVencimento: new Date(),
          tenantId: tenantId,
          obraId: ordemOriginal.obraId || "", 
          clienteFornecedor: ordemOriginal.fornecedor.nome,
        },
      });
      transacaoId = novaTransacao.id;
    }

    // 2. Regra de Estoque: Dar entrada física quando ENTREGUE
    if (newStatus === "ENTREGUE" && ordemOriginal.status !== "ENTREGUE") {
      if (!checkRole(userAuth.role, ['MASTER', 'ALMOXARIFE', 'ENGENHARIA'])) {
        return NextResponse.json({ success: false, error: 'Acesso negado: Apenas Almoxarife ou Engenharia pode confirmar recebimento.' }, { status: 403 });
      }

      // Pega os itens da ordem
      const itensOrdem = await prisma.ordemCompraItem.findMany({
        where: { ordemCompraId: id, tenantId }
      });

      if (ordemOriginal.obraId && itensOrdem.length > 0) {
        // Encontra o estoque da obra
        const estoque = await prisma.estoque.findUnique({
          where: { obraId: ordemOriginal.obraId }
        });

        if (estoque) {
          // Para cada item comprado, adiciona no estoque (upsert)
          for (const item of itensOrdem) {
            const estoqueItem = await prisma.estoqueItem.findUnique({
              where: {
                estoqueId_produtoId: {
                  estoqueId: estoque.id,
                  produtoId: item.produtoId
                }
              }
            });

            if (estoqueItem) {
              await prisma.estoqueItem.update({
                where: { id: estoqueItem.id },
                data: { quantidade: { increment: item.quantidade } }
              });
            } else {
              await prisma.estoqueItem.create({
                data: {
                  estoqueId: estoque.id,
                  produtoId: item.produtoId,
                  quantidade: item.quantidade,
                  tenantId: tenantId
                }
              });
            }
          }
        }
      }
    }

    const ordem = await prisma.ordemCompra.update({
      where: { id, tenantId },
      data: {
        status: newStatus,
        dataEntrega: newStatus === "ENTREGUE" ? new Date() : data.dataEntrega,
        transacaoId: transacaoId,
      },
    });

    await registrarLog(userAuth.dbId, tenantId, 'ATUALIZAR_STATUS_OC', 'SUPRIMENTOS', {
      ordemId: id,
      novoStatus: newStatus
    });

    return NextResponse.json({ success: true, data: ordem });
  } catch (error: any) {
    console.error("Erro em PUT ordens-compra/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const { id } = await params;

    const ordem = await prisma.ordemCompra.deleteMany({
      where: {
        id,
        tenantId,
      },
    });

    if (ordem.count === 0) {
      return NextResponse.json({ error: "Ordem de Compra não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ message: "Excluída com sucesso" });
  } catch (error: any) {
    console.error("Erro em DELETE ordens-compra/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
