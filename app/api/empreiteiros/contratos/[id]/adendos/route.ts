import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken, registrarLog } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const { id: contratoEmpreiteiroId } = await params;
    const body = await request.json();

    const contrato = await prisma.contratoEmpreiteiro.findFirst({
      where: { id: contratoEmpreiteiroId, tenantId },
      include: {
        fornecedor: true,
        obra: true,
        adendos: true,
      },
    });

    if (!contrato) {
      return NextResponse.json({ success: false, error: "Contrato não encontrado." }, { status: 404 });
    }

    const {
      descricao,
      tipo = "VALOR_E_PRAZO",
      valorAdicional = 0,
      novaDataFim,
      dataAssinatura,
      documentoUrl,
    } = body;

    const proximoNumero = contrato.adendos.length + 1;

    const novoAdendo = await prisma.adendoContratoEmpreiteiro.create({
      data: {
        contratoEmpreiteiroId,
        numero: proximoNumero,
        descricao,
        tipo,
        valorAdicional: parseFloat(valorAdicional || "0"),
        novaDataFim: novaDataFim ? new Date(novaDataFim) : null,
        dataAssinatura: dataAssinatura ? new Date(dataAssinatura) : new Date(),
        documentoUrl,
        tenantId,
      },
    });

    // Se o adendo prorrogar o prazo, atualiza a dataFim do contrato principal
    if (novaDataFim) {
      await prisma.contratoEmpreiteiro.update({
        where: { id: contratoEmpreiteiroId },
        data: { dataFim: new Date(novaDataFim) },
      });
    }

    await registrarLog(userAuth.dbId, tenantId, "CRIAR_ADENDO_CONTRATO_EMPREITEIRO", "OBRAS", {
      contratoId: contratoEmpreiteiroId,
      adendoNumero: proximoNumero,
      descricao,
      valorAdicional,
      fornecedor: contrato.fornecedor.nome,
      obra: contrato.obra.nome,
    });

    return NextResponse.json({ success: true, data: novoAdendo }, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST adendos de contrato:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
