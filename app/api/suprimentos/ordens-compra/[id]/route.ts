import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

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

    // Se o status mudou para ENTREGUE e não havia transação financeira atrelada
    if (newStatus === "ENTREGUE" && ordemOriginal.status !== "ENTREGUE" && !transacaoId) {
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

    const ordem = await prisma.ordemCompra.update({
      where: { id, tenantId },
      data: {
        status: newStatus,
        dataEntrega: newStatus === "ENTREGUE" ? new Date() : data.dataEntrega,
        transacaoId: transacaoId,
      },
    });

    return NextResponse.json(ordem);
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
