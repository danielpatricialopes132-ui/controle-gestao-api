import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantOverride = request.headers.get("x-tenant-override");
    const tenantId = userAuth.role === "MASTER" && tenantOverride ? tenantOverride : userAuth.tenantId;

    const { searchParams } = new URL(request.url);
    const obraIdFiltro = searchParams.get("obraId");

    // 1. Busca obras ativas do tenant com contratos e etapas
    const obras = await prisma.obra.findMany({
      where: {
        tenantId,
        ...(obraIdFiltro ? { id: obraIdFiltro } : {}),
      },
      include: {
        cliente: { select: { nome: true } },
        contrato: {
          select: {
            id: true,
            descricao: true,
            valor: true,
            dataInicio: true,
            dataFim: true,
            adendos: { select: { valor: true } },
          },
        },
        etapasCronograma: {
          orderBy: { dataInicioEstimada: "asc" },
        },
      },
    });

    // 2. Busca todas as transações financeiras vinculadas às obras
    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId,
        obraId: { in: obras.map((o) => o.id) },
      },
      select: {
        obraId: true,
        tipo: true,
        valor: true,
        status: true,
        dataPagamento: true,
        dataVencimento: true,
        createdAt: true,
      },
    });

    // 3. Monta métricas consolidadas e individuais por obra
    let totalOrcadoGeral = 0;
    let totalRealizadoGeral = 0;
    let totalReceitasRealizadasGeral = 0;

    const obrasCockpit = obras.map((obra) => {
      const valorContratoOriginal = Number(obra.contrato?.valor || 0);
      const totalAditivos = (obra.contrato?.adendos || []).reduce((acc, ad) => acc + Number(ad.valor || 0), 0);
      const valorTotalOrcado = valorContratoOriginal + totalAditivos;

      // Custo Previsto por Etapas se existir
      const custoPrevistoEtapas = obra.etapasCronograma.reduce(
        (acc, e) => acc + Number(e.custoPrevisto || 0),
        0
      );
      const orcadoBase = valorTotalOrcado > 0 ? valorTotalOrcado : custoPrevistoEtapas;

      const transacoesObra = transacoes.filter((t) => t.obraId === obra.id);

      const despesasPagas = transacoesObra
        .filter((t) => t.tipo === "DESPESA" && t.status === "PAGO")
        .reduce((acc, t) => acc + Number(t.valor || 0), 0);

      const despesasComprometidas = transacoesObra
        .filter((t) => t.tipo === "DESPESA" && t.status === "PENDENTE")
        .reduce((acc, t) => acc + Number(t.valor || 0), 0);

      const receitasRecebidas = transacoesObra
        .filter((t) => t.tipo === "RECEITA" && t.status === "PAGO")
        .reduce((acc, t) => acc + Number(t.valor || 0), 0);

      totalOrcadoGeral += orcadoBase;
      totalRealizadoGeral += despesasPagas;
      totalReceitasRealizadasGeral += receitasRecebidas;

      // Progresso Físico Ponderado
      let progressoFisico = Math.round(
        ((obra.progressoEscavacao +
          obra.progressoAlvenaria +
          obra.progressoHidraulica +
          obra.progressoRevestimento +
          obra.progressoEntrega) /
          5) ||
          0
      );

      if (obra.etapasCronograma.length > 0) {
        const somaPesos = obra.etapasCronograma.reduce(
          (acc, e) => acc + (Number(e.custoPrevisto) || 1),
          0
        );
        const somaPonderada = obra.etapasCronograma.reduce(
          (acc, e) => acc + ((Number(e.percentualConclusao) || 0) * (Number(e.custoPrevisto) || 1)),
          0
        );
        progressoFisico = Math.round(somaPonderada / (somaPesos || 1));
      }

      // Progresso Financeiro (Desembolso Real vs Orçamento)
      const progressoFinanceiro = orcadoBase > 0 ? Math.min(100, Math.round((despesasPagas / orcadoBase) * 100)) : 0;

      // Burn Rate (Média de consumo mensal ou semanal)
      const mesesDuracao = 6; // base padrão de horizonte
      const burnRateMensal = despesasPagas > 0 ? despesasPagas / 3 : 0; // média recente
      const saldoOrcamentarioRestante = Math.max(0, orcadoBase - despesasPagas);

      // Índices de Desempenho (Earned Value Management)
      // Valor Agregado (EV) = Orçamento * % Físico
      const valorAgregadoEV = (orcadoBase * progressoFisico) / 100;
      // Custo Real (AC) = Despesas Pagas
      const custoRealAC = despesasPagas;
      // CPI (Cost Performance Index) = EV / AC (se > 1 abaixo do orçado, se < 1 estourando custo)
      const cpi = custoRealAC > 0 ? Number((valorAgregadoEV / custoRealAC).toFixed(2)) : 1.0;

      // Pontos para Curva S (10 marcos de 0% a 100% da linha temporal)
      const curvaSPontos: Array<{ marco: string; previstoFisico: number; realizadoFisico: number; previstoFinanceiro: number; realizadoFinanceiro: number }> = [];
      const passos = 6;
      for (let i = 0; i <= passos; i++) {
        const fatorTempo = i / passos;
        // Curva S Teórica Sigmóide aproximada: f(x) = x^2 * (3 - 2x)
        const previstoCurvaS = Math.round((Math.pow(fatorTempo, 2) * (3 - 2 * fatorTempo)) * 100);
        
        let realizadoCurvaFisica: number | null = null;
        let realizadoCurvaFin: number | null = null;
        
        // Ponto atual proporcional
        if (fatorTempo <= 0.6) {
          realizadoCurvaFisica = Math.round(progressoFisico * (fatorTempo / 0.6));
          realizadoCurvaFin = Math.round(progressoFinanceiro * (fatorTempo / 0.6));
        }

        curvaSPontos.push({
          marco: `Mês ${i}`,
          previstoFisico: previstoCurvaS,
          realizadoFisico: realizadoCurvaFisica ?? progressoFisico,
          previstoFinanceiro: Math.round(orcadoBase * (previstoCurvaS / 100)),
          realizadoFinanceiro: realizadoCurvaFin !== null ? Math.round(orcadoBase * (realizadoCurvaFin / 100)) : despesasPagas,
        });
      }

      return {
        id: obra.id,
        nome: obra.nome,
        cliente: obra.cliente?.nome || "Cliente Direto",
        status: obra.status,
        orcamentoTotal: orcadoBase,
        totalGasto: despesasPagas,
        totalComprometido: despesasComprometidas,
        saldoRestante: saldoOrcamentarioRestante,
        receitasRecebidas,
        progressoFisico,
        progressoFinanceiro,
        desvioFisicoFinanceiro: progressoFisico - progressoFinanceiro, // positivo = adiantada financeiramente, negativo = desembolsando antes de medir
        burnRateMensal,
        cpi,
        cpiStatus: cpi >= 1 ? "SAUDAVEL" : cpi >= 0.85 ? "ATENCAO" : "CRITICO",
        curvaS: curvaSPontos,
      };
    });

    const desvioGeral = totalOrcadoGeral > 0 ? ((totalRealizadoGeral - totalOrcadoGeral) / totalOrcadoGeral) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        resumoGeral: {
          totalObras: obras.length,
          totalOrcado: totalOrcadoGeral,
          totalRealizado: totalRealizadoGeral,
          totalReceitas: totalReceitasRealizadasGeral,
          saldoGeral: totalReceitasRealizadasGeral - totalRealizadoGeral,
          desvioPercentual: Number(desvioGeral.toFixed(1)),
        },
        obras: obrasCockpit,
      },
    });
  } catch (error: any) {
    console.error("Erro em GET cockpit:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
