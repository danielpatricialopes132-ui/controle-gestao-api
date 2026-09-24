import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken, registrarLog } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const { searchParams } = new URL(request.url);
    const obraId = searchParams.get("obraId");
    const fornecedorId = searchParams.get("fornecedorId");
    const status = searchParams.get("status");

    const where: any = { tenantId };
    if (obraId) where.obraId = obraId;
    if (fornecedorId) where.fornecedorId = fornecedorId;
    if (status) where.status = status;

    const contratos = await prisma.contratoEmpreiteiro.findMany({
      where,
      include: {
        obra: { select: { id: true, nome: true } },
        fornecedor: {
          select: {
            id: true,
            nome: true,
            cnpj: true,
            tipoFornecedor: true,
            empreiteiroPai: { select: { id: true, nome: true } },
          },
        },
        adendos: {
          orderBy: { numero: "asc" },
        },
        medicoes: {
          orderBy: { numero: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const contratosFormatados = contratos.map((c) => {
      const valorOriginal = Number(c.valorOriginal);
      const somaAditivos = c.adendos.reduce((acc, a) => acc + Number(a.valorAdicional), 0);
      const valorTotalAtualizado = valorOriginal + somaAditivos;

      const totalBrutoMedido = c.medicoes.reduce((acc, m) => acc + Number(m.valorBruto), 0);
      const totalLiquidoPago = c.medicoes
        .filter((m) => m.status === "APROVADA" || m.status === "PAGA")
        .reduce((acc, m) => acc + Number(m.valorLiquidoAPagar), 0);
      const totalRetencoes = c.medicoes.reduce(
        (acc, m) =>
          acc +
          Number(m.valorInssRetido) +
          Number(m.valorIssRetido) +
          Number(m.valorIrrfRetido),
        0
      );

      const saldoAExecutar = valorTotalAtualizado - totalBrutoMedido;

      return {
        ...c,
        valorOriginal,
        somaAditivos,
        valorTotalAtualizado,
        totalBrutoMedido,
        totalLiquidoPago,
        totalRetencoes,
        saldoAExecutar,
      };
    });

    return NextResponse.json({ success: true, data: contratosFormatados });
  } catch (error: any) {
    console.error("Erro em GET /api/empreiteiros/contratos:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const body = await request.json();

    const {
      numero,
      descricao,
      valorOriginal,
      dataInicio,
      dataFim,
      obraId,
      fornecedorId,
      aliquotaInss = 11.0,
      aliquotaIss = 5.0,
      aliquotaIrrf = 0.0,
      documentoContratoUrl,
      observacoes,
    } = body;

    if (!descricao || !obraId || !fornecedorId) {
      return NextResponse.json(
        { error: "Descrição, Obra e Empreiteiro são obrigatórios." },
        { status: 400 }
      );
    }

    const novoContrato = await prisma.contratoEmpreiteiro.create({
      data: {
        numero,
        descricao,
        valorOriginal: valorOriginal ? parseFloat(valorOriginal) : 0,
        dataInicio: dataInicio ? new Date(dataInicio) : null,
        dataFim: dataFim ? new Date(dataFim) : null,
        obraId,
        fornecedorId,
        aliquotaInss: parseFloat(aliquotaInss),
        aliquotaIss: parseFloat(aliquotaIss),
        aliquotaIrrf: parseFloat(aliquotaIrrf),
        documentoContratoUrl,
        observacoes,
        tenantId,
      },
      include: {
        obra: true,
        fornecedor: true,
      },
    });

    await registrarLog(userAuth.dbId, tenantId, "CRIAR_CONTRATO_EMPREITEIRO", "OBRAS", {
      contratoId: novoContrato.id,
      descricao: novoContrato.descricao,
      valorOriginal: novoContrato.valorOriginal,
      obra: novoContrato.obra?.nome,
      fornecedor: novoContrato.fornecedor?.nome,
    });

    return NextResponse.json({ success: true, data: novoContrato }, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST /api/empreiteiros/contratos:", error);
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
