import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    
    // Obter o tenantId ou validar acesso MASTER (neste caso, pegamos do userAuth)
    const tenantId = userAuth.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mesStr = searchParams.get('mes');
    const anoStr = searchParams.get('ano');
    const obraId = searchParams.get('obraId');

    const hoje = new Date();
    const mes = mesStr ? parseInt(mesStr, 10) : hoje.getMonth() + 1;
    const ano = anoStr ? parseInt(anoStr, 10) : hoje.getFullYear();

    // Primeiro dia do mês
    const startOfMonth = new Date(ano, mes - 1, 1);
    // Primeiro dia do mês seguinte
    const endOfMonth = new Date(ano, mes, 1);

    // Consulta de Transações do mês
    const whereClause: any = {
      tenantId: tenantId,
      dataVencimento: {
        gte: startOfMonth,
        lt: endOfMonth,
      },
    };

    if (obraId && obraId !== 'TODAS') {
      whereClause.obraId = obraId;
    }

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: whereClause,
      include: {
        categoriaFk: true,
      },
    });

    let totalReceitas = 0;
    let totalCustosDiretos = 0;
    let totalDespesasFixas = 0;

    const receitasPorCategoria: Record<string, number> = {};
    const custosDiretosPorCategoria: Record<string, number> = {};
    const despesasFixasPorCategoria: Record<string, number> = {};

    transacoes.forEach((t) => {
      const valor = Number(t.valor);
      const isReceita = t.tipo === 'RECEITA';
      
      const nomeCat = t.categoriaFk?.descricao ?? t.categoria ?? 'Sem Categoria';

      if (isReceita) {
        totalReceitas += valor;
        receitasPorCategoria[nomeCat] = (receitasPorCategoria[nomeCat] || 0) + valor;
      } else {
        if (t.obraId) {
          // É Custo Direto (Vinculado a Obra)
          totalCustosDiretos += valor;
          custosDiretosPorCategoria[nomeCat] = (custosDiretosPorCategoria[nomeCat] || 0) + valor;
        } else {
          // É Despesa Fixa/Administrativa (Sem Obra)
          totalDespesasFixas += valor;
          despesasFixasPorCategoria[nomeCat] = (despesasFixasPorCategoria[nomeCat] || 0) + valor;
        }
      }
    });

    const lucroBruto = totalReceitas - totalCustosDiretos;
    const lucroLiquido = lucroBruto - totalDespesasFixas;

    const resultado = {
      resumo: {
        receitas: totalReceitas,
        custosDiretos: totalCustosDiretos,
        lucroBruto: lucroBruto,
        margemBrutaPercentual: totalReceitas > 0 ? (lucroBruto / totalReceitas) * 100 : 0,
        despesasFixas: totalDespesasFixas,
        lucroLiquido: lucroLiquido,
        margemLiquidaPercentual: totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0,
      },
      receitas: Object.entries(receitasPorCategoria).map(([nome, valor]) => ({ categoria: nome, valor })).sort((a, b) => b.valor - a.valor),
      custosDiretos: Object.entries(custosDiretosPorCategoria).map(([nome, valor]) => ({ categoria: nome, valor })).sort((a, b) => b.valor - a.valor),
      despesasFixas: Object.entries(despesasFixasPorCategoria).map(([nome, valor]) => ({ categoria: nome, valor })).sort((a, b) => b.valor - a.valor),
    };

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Erro ao gerar relatório gerencial:', error);
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
