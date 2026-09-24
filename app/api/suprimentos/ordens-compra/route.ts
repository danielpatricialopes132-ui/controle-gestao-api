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

    // 1. Inteligência de Preços: Verificar se itens estão acima do preço base ou orçado
    const alertasPreco: Array<{ produtoId: string; produtoNome: string; precoUnitario: number; precoBase: number; diferencaPercentual: number; mensagem: string }> = [];

    if (Array.isArray(data.itens)) {
      const produtosIds = data.itens.map((i: any) => i.produtoId);
      const produtosCadastrados = await prisma.produto.findMany({
        where: { id: { in: produtosIds }, tenantId },
      });

      for (const item of data.itens) {
        const prod = produtosCadastrados.find((p) => p.id === item.produtoId);
        if (prod) {
          const precoUnitario = Number(item.precoUnitario);
          const precoBase = Number(prod.precoBase || 0);

          if (precoBase > 0 && precoUnitario > precoBase) {
            const diffPct = ((precoUnitario - precoBase) / precoBase) * 100;
            alertasPreco.push({
              produtoId: prod.id,
              produtoNome: prod.nome,
              precoUnitario,
              precoBase,
              diferencaPercentual: Number(diffPct.toFixed(1)),
              mensagem: `O insumo "${prod.nome}" está sendo cotado a R$ ${precoUnitario.toFixed(2)}, excedendo o preço orçado de referência (R$ ${precoBase.toFixed(2)}) em ${diffPct.toFixed(1)}%.`,
            });
          }
        }
      }
    }

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
        itens: {
          include: {
            produto: true,
          }
        },
        fornecedor: true,
        obra: true,
      },
    });

    const { registrarLog } = await import('@/lib/auth');
    await registrarLog(userAuth.dbId, tenantId, 'CRIAR_ORDEM_COMPRA', 'SUPRIMENTOS', {
      ordemId: novaOrdem.id,
      numero: novaOrdem.numero,
      valorTotal: novaOrdem.valorTotal,
      fornecedor: novaOrdem.fornecedor?.nome,
      qtdItens: novaOrdem.itens.length,
      alertasSobrepreco: alertasPreco.length > 0 ? alertasPreco : undefined,
    });

    return NextResponse.json({
      success: true,
      data: novaOrdem,
      alertasPreco,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST ordens-compra:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
