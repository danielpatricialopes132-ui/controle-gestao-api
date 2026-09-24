import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    
    const tenantId = userAuth.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mesStr = searchParams.get('mes');
    const anoStr = searchParams.get('ano');

    const hoje = new Date();
    const mes = mesStr ? parseInt(mesStr, 10) : hoje.getMonth() + 1;
    const ano = anoStr ? parseInt(anoStr, 10) : hoje.getFullYear();

    const startOfMonth = new Date(ano, mes - 1, 1);
    const endOfMonth = new Date(ano, mes, 1);

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId: tenantId,
        dataVencimento: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
      include: {
        obra: {
          select: { nome: true }
        }
      }
    });

    let faturamentoTotal = 0;
    let custosFixosTotais = 0;

    // Estrutura por Obra
    // obraId -> { nome, receitas, custosDiretos }
    const obrasMap: Record<string, { nome: string, receitas: number, custosDiretos: number }> = {};

    transacoes.forEach((t) => {
      const valor = Number(t.valor);
      const isReceita = t.tipo === 'RECEITA';

      if (t.obraId) {
        if (!obrasMap[t.obraId]) {
          obrasMap[t.obraId] = { nome: t.obra?.nome || 'Obra Desconhecida', receitas: 0, custosDiretos: 0 };
        }
        if (isReceita) {
          obrasMap[t.obraId].receitas += valor;
          faturamentoTotal += valor;
        } else {
          obrasMap[t.obraId].custosDiretos += valor;
        }
      } else {
        // Sem Obra = Custo Fixo / Rateio Administrativo
        if (!isReceita) {
          custosFixosTotais += valor;
        }
      }
    });

    const resultado = Object.values(obrasMap).map(obra => {
      const lucroBruto = obra.receitas - obra.custosDiretos;
      
      // Regra de Rateio: Proporcional ao Faturamento
      // Se não houver faturamento na empresa no mês, dividimos igualmente entre as obras ativas no mês?
      // Para evitar divisão por zero, rateio = 0 ou divisão igualitária.
      let percentualRateio = 0;
      if (faturamentoTotal > 0) {
        percentualRateio = obra.receitas / faturamentoTotal;
      } else {
        const qtdObras = Object.keys(obrasMap).length;
        if (qtdObras > 0) {
          percentualRateio = 1 / qtdObras;
        }
      }

      const rateioDespesasFixas = custosFixosTotais * percentualRateio;
      const lucroLiquido = lucroBruto - rateioDespesasFixas;
      
      return {
        ...obra,
        lucroBruto,
        rateioDespesasFixas,
        lucroLiquido,
        margemLiquida: obra.receitas > 0 ? (lucroLiquido / obra.receitas) * 100 : 0
      };
    });

    // Ordenar pelo maior lucro
    resultado.sort((a, b) => b.lucroLiquido - a.lucroLiquido);

    return NextResponse.json({
      resumo: {
        faturamentoTotal,
        custosFixosTotais,
      },
      obras: resultado
    });
  } catch (error) {
    console.error('Erro ao gerar lucratividade:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar relatório' },
      { status: 500 }
    );
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
