import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await verifyIdToken(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const notas = await prisma.notaFiscal.findMany({
      where: { tenantId: auth.tenantId, obraId: params.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(notas);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
