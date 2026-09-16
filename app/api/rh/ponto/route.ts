import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyAuth(request);
    if (!userAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dataStr = searchParams.get("data");
    const obraId = searchParams.get("obraId");

    const tenantId = userAuth.tenantId;

    if (!dataStr) {
      return NextResponse.json({ error: "Data é obrigatória" }, { status: 400 });
    }

    const funcionarios = await prisma.funcionario.findMany({
      where: { tenantId },
      orderBy: { nome: "asc" },
    });

    let pontosExistentes: any[] = [];
    if (obraId) {
      const dataQuery = new Date(dataStr);
      pontosExistentes = await prisma.registroPresenca.findMany({
        where: {
          tenantId,
          obraId,
          data: dataQuery,
        },
      });
    }

    const obras = await prisma.obra.findMany({
      where: { tenantId, status: "EM_ANDAMENTO" },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json({ funcionarios, pontosExistentes, obras });
  } catch (error) {
    console.error("Erro no GET Ponto:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyAuth(request);
    if (!userAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = userAuth.tenantId;
    const { data, obraId, registros } = await request.json();

    if (!data || !obraId || !registros || !Array.isArray(registros)) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const dataObj = new Date(data);

    await prisma.registroPresenca.deleteMany({
      where: {
        tenantId,
        obraId,
        data: dataObj,
      },
    });

    const validRegistros = registros.filter((r: any) => r.status !== "NA");

    if (validRegistros.length > 0) {
      const dataToInsert = validRegistros.map((r: any) => ({
        tenantId,
        obraId,
        funcionarioId: r.funcionarioId,
        data: dataObj,
        status: r.status,
        horasTrabalhadas: r.horasTrabalhadas || 8,
        percentualPago: r.percentualPago || 100,
        observacao: r.observacoes || "",
        statusAprovacao: userAuth.role === "MASTER" ? "APROVADO" : "PENDENTE",
      }));

      await prisma.registroPresenca.createMany({
        data: dataToInsert,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no POST Ponto:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
