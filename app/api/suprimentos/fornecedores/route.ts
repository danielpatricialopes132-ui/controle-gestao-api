import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;

    const fornecedores = await prisma.fornecedor.findMany({
      where: { tenantId },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(fornecedores);
  } catch (error: any) {
    console.error("Erro em GET fornecedores:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const data = await request.json();

    const novoFornecedor = await prisma.fornecedor.create({
      data: {
        nome: data.nome,
        cnpj: data.cnpj,
        telefone: data.telefone,
        email: data.email,
        tenantId,
      },
    });

    return NextResponse.json(novoFornecedor, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST fornecedores:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
