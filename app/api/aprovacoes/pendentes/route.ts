import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";
import { validarAlcadaUsuario } from "@/lib/workflowAprovacao";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;

    // 1. Ordens de Compra Pendentes
    const ordensPendentes = await prisma.ordemCompra.findMany({
      where: {
        tenantId,
        status: "PENDENTE",
      },
      include: {
        fornecedor: { select: { nome: true } },
        obra: { select: { nome: true } },
        itens: {
          include: { produto: { select: { nome: true, unidade: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Medições de Empreiteiro Pendentes
    const medicoesPendentes = await prisma.medicaoEmpreiteiro.findMany({
      where: {
        tenantId,
        status: "PENDENTE",
      },
      include: {
        contratoEmpreiteiro: {
          select: {
            descricao: true,
            numero: true,
            fornecedor: { select: { nome: true } },
            obra: { select: { nome: true } },
          },
        },
      },
      orderBy: { dataMedicao: "desc" },
    });

    // Mapeia e avalia a permissão do usuário atual para aprovar cada item
    const ordensFormatadas = await Promise.all(
      ordensPendentes.map(async (oc) => {
        const valor = Number(oc.valorTotal || 0);
        const validacao = await validarAlcadaUsuario({
          tenantId,
          userRole: userAuth.role,
          tipoEntidade: "ORDEM_COMPRA",
          valor,
        });

        return {
          id: oc.id,
          tipo: "ORDEM_COMPRA",
          numero: oc.numero,
          titulo: `OC #${oc.numero} - ${oc.fornecedor?.nome ?? "Fornecedor"}`,
          subtitulo: oc.obra ? `Obra: ${oc.obra.nome}` : "Geral / Matriz",
          valorTotal: valor,
          data: oc.createdAt,
          podeAprovar: validacao.podeAprovar,
          motivoAlcada: validacao.motivo,
          aprovadorNecessarioRole: validacao.aprovadorNecessarioRole,
          itensQtd: oc.itens.length,
          detalhes: oc,
        };
      })
    );

    const medicoesFormatadas = await Promise.all(
      medicoesPendentes.map(async (med) => {
        const valorLiquido = Number(med.valorLiquidoAPagar || 0);
        const validacao = await validarAlcadaUsuario({
          tenantId,
          userRole: userAuth.role,
          tipoEntidade: "MEDICAO_EMPREITEIRO",
          valor: valorLiquido,
        });

        return {
          id: med.id,
          tipo: "MEDICAO_EMPREITEIRO",
          numero: med.numero,
          titulo: `Medição #${med.numero} - ${med.contratoEmpreiteiro.fornecedor?.nome}`,
          subtitulo: `Contrato: ${med.contratoEmpreiteiro.numero ?? ""} (${med.contratoEmpreiteiro.obra?.nome ?? "Obra"})`,
          valorTotal: valorLiquido,
          valorBruto: Number(med.valorBruto || 0),
          data: med.dataMedicao,
          podeAprovar: validacao.podeAprovar,
          motivoAlcada: validacao.motivo,
          aprovadorNecessarioRole: validacao.aprovadorNecessarioRole,
          detalhes: med,
        };
      })
    );

    const todas = [...ordensFormatadas, ...medicoesFormatadas];
    todas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return NextResponse.json({
      success: true,
      totalPendentes: todas.length,
      totalPodeAprovar: todas.filter((i) => i.podeAprovar).length,
      itens: todas,
    });
  } catch (error: any) {
    console.error("Erro em GET aprovacoes:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
