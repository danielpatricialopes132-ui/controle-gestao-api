import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;

    const produtos = await prisma.produto.findMany({
      where: { tenantId },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(produtos);
  } catch (error: any) {
    console.error("Erro em GET produtos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const data = await request.json();

    const novoProduto = await prisma.produto.create({
      data: {
        nome: data.nome,
        unidadeMedida: data.unidadeMedida,
        precoBase: data.precoBase,
        tenantId,
      },
    });

    return NextResponse.json(novoProduto, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST produtos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
