import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantOverride = request.headers.get('x-tenant-override');
    const tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // MATERIAL, EMPREITEIRO, SUBCONTRATADO, etc.

    const where: any = { tenantId };
    if (tipo) {
      where.tipoFornecedor = tipo;
    }

    const fornecedores = await prisma.fornecedor.findMany({
      where,
      include: {
        empreiteiroPai: {
          select: { id: true, nome: true, cnpj: true },
        },
        subcontratados: {
          select: { id: true, nome: true, cnpj: true, tipoFornecedor: true },
        },
        _count: {
          select: {
            contratosEmpreiteiro: true,
            funcionarios: true,
            ordens: true,
          }
        }
      },
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

    const tenantOverride = request.headers.get('x-tenant-override');
    const tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;
    const data = await request.json();

    const novoFornecedor = await prisma.fornecedor.create({
      data: {
        nome: data.nome,
        cnpj: data.cnpj,
        telefone: data.telefone,
        email: data.email,
        tipoFornecedor: data.tipoFornecedor || "MATERIAL",
        empreiteiroPaiId: data.empreiteiroPaiId || null,
        chavePix: data.chavePix || null,
        banco: data.banco || null,
        agencia: data.agencia || null,
        conta: data.conta || null,
        cndInssValidade: data.cndInssValidade ? new Date(data.cndInssValidade) : null,
        cndTrabalhistaValidade: data.cndTrabalhistaValidade ? new Date(data.cndTrabalhistaValidade) : null,
        tenantId,
      },
      include: {
        empreiteiroPai: true,
      }
    });

    const { registrarLog } = await import('@/lib/auth');
    await registrarLog(userAuth.dbId, tenantId, 'CRIAR_FORNECEDOR', 'SUPRIMENTOS', {
      fornecedorId: novoFornecedor.id,
      nome: novoFornecedor.nome,
      tipoFornecedor: novoFornecedor.tipoFornecedor,
      empreiteiroPaiId: novoFornecedor.empreiteiroPaiId,
    });

    return NextResponse.json(novoFornecedor, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST fornecedores:", error);
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
