import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth || (userAuth.role !== "MASTER" && userAuth.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = userAuth.tenantId;

    const pendentes = await prisma.registroPresenca.findMany({
      where: {
        tenantId,
        statusAprovacao: "PENDENTE",
      },
      include: {
        funcionario: { select: { nome: true, cargo: true } },
        obra: { select: { nome: true } },
      },
      orderBy: { data: "desc" },
    });

    return NextResponse.json(pendentes);
  } catch (error) {
    console.error("Erro no GET Pontos Pendentes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
