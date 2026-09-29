import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken, checkRole, registrarLog } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const alcadas = await prisma.alcadaAprovacao.findMany({
      where: { tenantId },
      orderBy: { valorMinimo: "asc" },
    });

    return NextResponse.json({ success: true, data: alcadas });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!checkRole(userAuth.role, ["MASTER", "DIRETORIA"])) {
      return NextResponse.json(
        { success: false, error: "Apenas Master ou Diretoria podem cadastrar regras de alçada." },
        { status: 403 }
      );
    }

    const tenantId = userAuth.tenantId;
    const data = await request.json();

    const novaAlcada = await prisma.alcadaAprovacao.create({
      data: {
        tenantId,
        tipoEntidade: data.tipoEntidade,
        valorMinimo: data.valorMinimo ?? 0,
        valorMaximo: data.valorMaximo ? data.valorMaximo : null,
        roleAprovador: data.roleAprovador,
        descricao: data.descricao || null,
        ativo: data.ativo ?? true,
      },
    });

    await registrarLog(userAuth.dbId, tenantId, "CRIAR_ALCADA_APROVACAO", "GOVERNANCA", {
      alcadaId: novaAlcada.id,
      tipoEntidade: novaAlcada.tipoEntidade,
      roleAprovador: novaAlcada.roleAprovador,
      valorMin: novaAlcada.valorMinimo,
      valorMax: novaAlcada.valorMaximo,
    });

    return NextResponse.json({ success: true, data: novaAlcada }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
