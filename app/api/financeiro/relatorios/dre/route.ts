import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dataInicioParam = searchParams.get('dataInicio');
    const dataFimParam = searchParams.get('dataFim');

    const hoje = new Date();
    const dataInicio = dataInicioParam ? new Date(dataInicioParam) : new Date(hoje.getFullYear(), 0, 1); // Default: ano inteiro
    const dataFim = dataFimParam ? new Date(dataFimParam) : new Date(hoje.getFullYear(), 11, 31, 23, 59, 59);

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId: userAuth.tenantId,
        dataPagamento: {
          gte: dataInicio,
          lte: dataFim
        },
        status: 'PAGO'
      },
      include: {
        categoriaFk: true,
      }
    });

    let receitaBruta = 0;
    let deducoes = 0; // Ex: Impostos sobre vendas
    let custosDiretos = 0; // Ex: Insumos, Mão de Obra de Obras
    let despesasOperacionais = 0; // Ex: Administrativo, Aluguel
    let outrasReceitasDespesas = 0; // Ex: Rendimento Financeiro, Juros Pagos

    // Estrutura detalhada
    const detalhamento = {
      receitas: {} as Record<string, number>,
      deducoes: {} as Record<string, number>,
      custosDiretos: {} as Record<string, number>,
      despesasOperacionais: {} as Record<string, number>,
      outrasReceitasDespesas: {} as Record<string, number>,
    };

    transacoes.forEach(t => {
      const valor = Number(t.valor);
      const categoriaNome = t.categoriaFk?.descricao ?? t.categoria ?? 'Outros';

      if (t.tipo === 'RECEITA') {
        // Se for receita financeira
        if (categoriaNome.toLowerCase().includes('rendimento') || categoriaNome.toLowerCase().includes('financeira')) {
          outrasReceitasDespesas += valor;
          detalhamento.outrasReceitasDespesas[categoriaNome] = (detalhamento.outrasReceitasDespesas[categoriaNome] || 0) + valor;
        } else {
          receitaBruta += valor;
          detalhamento.receitas[categoriaNome] = (detalhamento.receitas[categoriaNome] || 0) + valor;
        }
      } else {
        // DESPESA
        const nomeLower = categoriaNome.toLowerCase();
        if (nomeLower.includes('imposto') && nomeLower.includes('venda')) {
          deducoes += valor;
          detalhamento.deducoes[categoriaNome] = (detalhamento.deducoes[categoriaNome] || 0) + valor;
        } else if (t.obraId) {
          // Se tem obra vinculada, é custo direto da obra
          custosDiretos += valor;
          detalhamento.custosDiretos[categoriaNome] = (detalhamento.custosDiretos[categoriaNome] || 0) + valor;
        } else if (nomeLower.includes('juros') || nomeLower.includes('tarifa')) {
          outrasReceitasDespesas -= valor;
          detalhamento.outrasReceitasDespesas[categoriaNome] = (detalhamento.outrasReceitasDespesas[categoriaNome] || 0) - valor;
        } else {
          despesasOperacionais += valor;
          detalhamento.despesasOperacionais[categoriaNome] = (detalhamento.despesasOperacionais[categoriaNome] || 0) + valor;
        }
      }
    });

    const receitaLiquida = receitaBruta - deducoes;
    const lucroBruto = receitaLiquida - custosDiretos;
    const ebitda = lucroBruto - despesasOperacionais;
    const lucroLiquido = ebitda + outrasReceitasDespesas; // outrasReceitasDespesas já tem sinal correto (+ para receita, - para despesa financeira)

    // Converte os objetos detalhados em arrays ordenados para o chart
    const formatDetalhe = (obj: Record<string, number>) => {
      return Object.entries(obj)
        .map(([categoria, valor]) => ({ categoria, valor }))
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
    };

    return NextResponse.json({
      periodo: {
        inicio: dataInicio,
        fim: dataFim
      },
      indicadores: {
        receitaBruta,
        deducoes,
        receitaLiquida,
        custosDiretos,
        lucroBruto,
        margemBruta: receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0,
        despesasOperacionais,
        ebitda,
        margemEbitda: receitaLiquida > 0 ? (ebitda / receitaLiquida) * 100 : 0,
        outrasReceitasDespesas,
        lucroLiquido,
        margemLiquida: receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0,
      },
      detalhamento: {
        receitas: formatDetalhe(detalhamento.receitas),
        deducoes: formatDetalhe(detalhamento.deducoes),
        custosDiretos: formatDetalhe(detalhamento.custosDiretos),
        despesasOperacionais: formatDetalhe(detalhamento.despesasOperacionais),
        outrasReceitasDespesas: formatDetalhe(detalhamento.outrasReceitasDespesas),
      }
    });

  } catch (error: any) {
    console.error('Erro ao gerar DRE:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
