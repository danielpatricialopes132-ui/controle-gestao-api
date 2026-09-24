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

    const fornecedor = await prisma.fornecedor.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        nome: data.nome,
        cnpj: data.cnpj,
        telefone: data.telefone,
        email: data.email,
      },
    });

    if (fornecedor.count === 0) {
      return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Atualizado com sucesso" });
  } catch (error: any) {
    console.error("Erro em PUT fornecedores/[id]:", error);
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

    const fornecedor = await prisma.fornecedor.deleteMany({
      where: {
        id,
        tenantId,
      },
    });

    if (fornecedor.count === 0) {
      return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Excluído com sucesso" });
  } catch (error: any) {
    console.error("Erro em DELETE fornecedores/[id]:", error);
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
