import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken, registrarLog } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const { id: contratoEmpreiteiroId } = await params;

    const medicoes = await prisma.medicaoEmpreiteiro.findMany({
      where: {
        contratoEmpreiteiroId,
        tenantId,
      },
      include: {
        transacao: true,
      },
      orderBy: { numero: "desc" },
    });

    return NextResponse.json({ success: true, data: medicoes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

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
        medicoes: true,
      },
    });

    if (!contrato) {
      return NextResponse.json({ success: false, error: "Contrato não encontrado." }, { status: 404 });
    }

    const {
      descricao,
      valorBruto,
      periodoInicio,
      periodoFim,
      valorDeducaoSubcontratados = 0,
      valorAdiantamentosDescontados = 0,
      status = "PENDENTE",
      relatorioFotograficoUrl,
      notaFiscalUrl,
      observacoes,
    } = body;

    const vBruto = parseFloat(valorBruto || "0");
    const vDeducaoSub = parseFloat(valorDeducaoSubcontratados || "0");
    const vAdiantamentos = parseFloat(valorAdiantamentosDescontados || "0");

    // Base de cálculo para INSS: Deduz materiais ou subcontratados comprovados (Art. 31 Lei 8.212/91)
    const baseCalculoInss = Math.max(0, vBruto - vDeducaoSub);
    const inssRetido = baseCalculoInss * (Number(contrato.aliquotaInss) / 100);
    const issRetido = vBruto * (Number(contrato.aliquotaIss) / 100);
    const irrfRetido = vBruto * (Number(contrato.aliquotaIrrf) / 100);

    const valorLiquidoAPagar = Math.max(
      0,
      vBruto - inssRetido - issRetido - irrfRetido - vAdiantamentos
    );

    const proximoNumero = contrato.medicoes.length + 1;

    let transacaoCriadaId: string | null = null;

    // Se a medição for lançada como APROVADA, já cria a transação de despesa líquida no contas a pagar
    if (status === "APROVADA") {
      const transacao = await prisma.transacaoFinanceira.create({
        data: {
          tipo: "DESPESA",
          descricao: `Medição #${proximoNumero} - ${contrato.descricao} (${contrato.fornecedor.nome})`,
          valor: valorLiquidoAPagar,
          status: "PENDENTE",
          dataVencimento: new Date(),
          obraId: contrato.obraId,
          clienteFornecedor: contrato.fornecedor.nome,
          observacao: `Valor Bruto: R$ ${vBruto.toFixed(2)} | Retenções: INSS R$ ${inssRetido.toFixed(2)}, ISS R$ ${issRetido.toFixed(2)} | Adiantamentos Descontados: R$ ${vAdiantamentos.toFixed(2)}`,
          tenantId,
        },
      });
      transacaoCriadaId = transacao.id;
    }

    const novaMedicao = await prisma.medicaoEmpreiteiro.create({
      data: {
        contratoEmpreiteiroId,
        numero: proximoNumero,
        descricao: descricao || `${proximoNumero}ª Medição de Serviços`,
        valorBruto: vBruto,
        valorInssRetido: inssRetido,
        valorIssRetido: issRetido,
        valorIrrfRetido: irrfRetido,
        valorDeducaoSubcontratados: vDeducaoSub,
        valorAdiantamentosDescontados: vAdiantamentos,
        valorLiquidoAPagar,
        status,
        periodoInicio: periodoInicio ? new Date(periodoInicio) : null,
        periodoFim: periodoFim ? new Date(periodoFim) : null,
        relatorioFotograficoUrl,
        notaFiscalUrl,
        observacoes,
        tenantId,
      },
    });

    if (transacaoCriadaId) {
      await prisma.transacaoFinanceira.update({
        where: { id: transacaoCriadaId },
        data: { medicaoEmpreiteiroId: novaMedicao.id },
      });
    }

    await registrarLog(userAuth.dbId, tenantId, "CRIAR_MEDICAO_EMPREITEIRO", "OBRAS", {
      medicaoId: novaMedicao.id,
      contratoId: contratoEmpreiteiroId,
      numero: proximoNumero,
      valorBruto: vBruto,
      valorLiquido: valorLiquidoAPagar,
      inssRetido,
      issRetido,
      deducaoSubcontratados: vDeducaoSub,
      fornecedor: contrato.fornecedor.nome,
      obra: contrato.obra.nome,
    });

    return NextResponse.json({ success: true, data: novaMedicao }, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST medições:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
