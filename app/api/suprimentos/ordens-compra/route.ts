import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;

    const ordens = await prisma.ordemCompra.findMany({
      where: { tenantId },
      include: {
        fornecedor: true,
        obra: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(ordens);
  } catch (error: any) {
    console.error("Erro em GET ordens-compra:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const data = await request.json();

    // Cria a ordem e os itens usando nested writes
    const novaOrdem = await prisma.ordemCompra.create({
      data: {
        fornecedorId: data.fornecedorId,
        obraId: data.obraId || null,
        valorTotal: data.valorTotal || 0,
        status: data.status || "PENDENTE",
        dataPrevisao: data.dataPrevisao ? new Date(data.dataPrevisao) : null,
        tenantId,
        itens: {
          create: data.itens.map((item: any) => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            tenantId,
          })),
        },
      },
      include: {
        itens: true,
      },
    });

    return NextResponse.json(novaOrdem, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST ordens-compra:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
