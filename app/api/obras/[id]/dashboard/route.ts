import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { id } = await params;

    const obra = await prisma.obra.findFirst({
      where: {
        id: id,
        tenantId: userAuth.tenantId,
      },
      include: {
        etapasCronograma: true,
      }
    });

    if (!obra) {
      return NextResponse.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        obraId: id,
        tenantId: userAuth.tenantId,
        status: 'PAGO'
      },
      include: {
        categoriaFk: true,
      }
    });

    let totalReceitas = 0;
    let totalDespesas = 0;
    const despesasPorCategoria: Record<string, number> = {};

    transacoes.forEach(t => {
      const valor = Number(t.valor);
      const categoria = t.categoriaFk?.descricao ?? t.categoria ?? 'Outros';

      if (t.tipo === 'RECEITA') {
        totalReceitas += valor;
      } else {
        totalDespesas += valor;
        despesasPorCategoria[categoria] = (despesasPorCategoria[categoria] || 0) + valor;
      }
    });

    const lucro = totalReceitas - totalDespesas;
    
    // Calcula orçado se tiver
    let totalOrcado = 0;
    if (obra.etapasCronograma) {
      totalOrcado = obra.etapasCronograma.reduce((acc, curr) => acc + (Number(curr.custoPrevisto) || 0), 0);
    }

    const formatDetalhe = (obj: Record<string, number>) => {
      return Object.entries(obj)
        .map(([categoria, valor]) => ({ categoria, valor }))
        .sort((a, b) => b.valor - a.valor);
    };

    return NextResponse.json({
      obra: {
        id: obra.id,
        nome: obra.nome,
        status: obra.status,
      },
      financeiro: {
        totalReceitas,
        totalDespesas,
        lucro,
        margemLucro: totalReceitas > 0 ? (lucro / totalReceitas) * 100 : 0,
        totalOrcado,
        percentualCustoOrcamento: totalOrcado > 0 ? (totalDespesas / totalOrcado) * 100 : 0,
      },
      despesasPorCategoria: formatDetalhe(despesasPorCategoria),
    });

  } catch (error: any) {
    console.error('Erro ao carregar dashboard da obra:', error);
    require('fs').writeFileSync('C:\\Controle-Gestao\\backend\\error-dump.txt', error.stack || error.message);
    return NextResponse.json({ error: 'Erro interno no servidor', details: error.message }, { status: 500 });
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
