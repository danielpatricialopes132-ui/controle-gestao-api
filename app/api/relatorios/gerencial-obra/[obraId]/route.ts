import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

export async function GET(request: Request, { params }: { params: { obraId: string } }) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;
    const { obraId } = params;

    const obra = await prisma.obra.findUnique({
      where: { id: obraId, tenantId },
      include: {
        contrato: {
          include: { adendos: true }
        }
      }
    });

    if (!obra) {
      return NextResponse.json({ success: false, error: 'Obra não encontrada' }, { status: 404 });
    }

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: { tenantId, obraId, status: 'PAGO' },
      include: {
        funcionario: { select: { nome: true } },
      }
    });

    // 1. Entradas (Faturamento)
    const entradas: any[] = [];
    let totalEntradasRealizado = 0;
    let totalEntradasPrevisto = 0;

    // Contrato Base
    if (obra.contrato) {
      const valorPrevistoContrato = Number(obra.contrato.valor);
      const valorRealizadoContrato = transacoes
        .filter(t => t.tipo === 'RECEITA' && t.categoria === 'CONTRATO_PRINCIPAL')
        .reduce((sum, t) => sum + Number(t.valor), 0);

      totalEntradasPrevisto += valorPrevistoContrato;
      totalEntradasRealizado += valorRealizadoContrato;

      entradas.push({
        id: obra.contrato.id,
        tipo: 'CONTRATO_PRINCIPAL',
        descricao: 'Contrato Base',
        previsto: valorPrevistoContrato,
        realizado: valorRealizadoContrato,
      });

      // Adendos
      for (const adendo of obra.contrato.adendos) {
        const valorPrevistoAdendo = Number(adendo.valor);
        const valorRealizadoAdendo = transacoes
          .filter(t => t.tipo === 'RECEITA' && t.adendoId === adendo.id)
          .reduce((sum, t) => sum + Number(t.valor), 0);

        totalEntradasPrevisto += valorPrevistoAdendo;
        totalEntradasRealizado += valorRealizadoAdendo;

        entradas.push({
          id: adendo.id,
          tipo: 'ADENDO',
          descricao: adendo.descricao,
          previsto: valorPrevistoAdendo,
          realizado: valorRealizadoAdendo,
        });
      }
    }

    // 2. Saídas (Custos/Despesas)
    // Agrupar folha de pagamento por funcionário
    const folhaPagamentoMap: Record<string, { nome: string; valor: number }> = {};
    let totalFolha = 0;
    let outrasDespesas = 0;

    transacoes.filter(t => t.tipo === 'DESPESA').forEach(t => {
      // Se for pagamento de funcionário (Salário/Vales)
      if (t.funcionarioId && (t.categoria === 'PESSOAL' || t.descricao.toLowerCase().includes('salário'))) {
        if (!folhaPagamentoMap[t.funcionarioId]) {
          folhaPagamentoMap[t.funcionarioId] = {
            nome: t.funcionario?.nome || 'Desconhecido',
            valor: 0
          };
        }
        folhaPagamentoMap[t.funcionarioId].valor += Number(t.valor);
        totalFolha += Number(t.valor);
      } else {
        outrasDespesas += Number(t.valor);
      }
    });

    const folhaPagamento = Object.values(folhaPagamentoMap);
    const totalSaidasRealizado = totalFolha + outrasDespesas;

    // 3. Lucro e Margem
    const lucroCaixa = totalEntradasRealizado - totalSaidasRealizado;
    const margem = totalEntradasRealizado > 0 ? (lucroCaixa / totalEntradasRealizado) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        obra: {
          id: obra.id,
          nome: obra.nome,
          status: obra.status,
        },
        resumo: {
          lucroCaixa,
          margem,
          totalEntradasPrevisto,
          totalEntradasRealizado,
          totalSaidasRealizado,
        },
        entradas,
        saidas: {
          folhaPagamento,
          outrasDespesas
        }
      }
    });
  } catch (error: any) {
    console.error('Erro em gerencial-obra API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
