import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth || (userAuth.role !== "MASTER" && userAuth.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = userAuth.tenantId;
    const { id, ids, statusAprovacao } = await request.json();

    if (!statusAprovacao || !["APROVADO", "REJEITADO"].includes(statusAprovacao)) {
      return NextResponse.json({ error: "Status de aprovação inválido" }, { status: 400 });
    }

    if (ids && Array.isArray(ids)) {
      // Aprovação em lote
      await prisma.registroPresenca.updateMany({
        where: {
          id: { in: ids },
          tenantId,
        },
        data: {
          statusAprovacao,
        },
      });
    } else if (id) {
      // Aprovação individual
      await prisma.registroPresenca.updateMany({
        where: {
          id,
          tenantId,
        },
        data: {
          statusAprovacao,
        },
      });
    } else {
      return NextResponse.json({ error: "ID(s) não fornecido(s)" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no POST Aprovar Ponto:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
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
