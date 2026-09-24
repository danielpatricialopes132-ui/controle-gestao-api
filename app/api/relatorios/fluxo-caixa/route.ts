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
    const mesesNaFrente = searchParams.get('meses') ? parseInt(searchParams.get('meses')!, 10) : 6;

    const hoje = new Date();
    const startOfCurrentMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const endOfRange = new Date(hoje.getFullYear(), hoje.getMonth() + mesesNaFrente, 1);

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId: tenantId,
        dataVencimento: {
          gte: startOfCurrentMonth,
          lt: endOfRange,
        },
      },
      select: {
        valor: true,
        tipo: true,
        status: true,
        isConciliada: true,
        dataVencimento: true,
      }
    });

    // Estruturar dados por "Mês/Ano"
    const fluxo: Record<string, { mesAno: string, receitasRealizadas: number, receitasProjetadas: number, despesasRealizadas: number, despesasProjetadas: number }> = {};

    // Inicializar os meses
    for (let i = 0; i < mesesNaFrente; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const mesStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      fluxo[mesStr] = {
        mesAno: mesStr,
        receitasRealizadas: 0,
        receitasProjetadas: 0,
        despesasRealizadas: 0,
        despesasProjetadas: 0,
      };
    }

    transacoes.forEach((t) => {
      if (!t.dataVencimento) return;
      const d = new Date(t.dataVencimento);
      const mesStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      
      if (!fluxo[mesStr]) return;

      const valor = Number(t.valor);
      const isRealizado = t.status === 'PAGO' || t.status === 'RECEBIDO' || t.isConciliada === true;
      const isReceita = t.tipo === 'RECEITA';

      if (isReceita) {
        if (isRealizado) fluxo[mesStr].receitasRealizadas += valor;
        else fluxo[mesStr].receitasProjetadas += valor;
      } else {
        if (isRealizado) fluxo[mesStr].despesasRealizadas += valor;
        else fluxo[mesStr].despesasProjetadas += valor;
      }
    });

    const resultadoArray = Object.values(fluxo).map(f => {
      const saldoRealizado = f.receitasRealizadas - f.despesasRealizadas;
      const saldoProjetado = f.receitasProjetadas - f.despesasProjetadas;
      const saldoTotalPrevisto = saldoRealizado + saldoProjetado;

      return {
        ...f,
        saldoRealizado,
        saldoProjetado,
        saldoTotalPrevisto,
      };
    });

    return NextResponse.json(resultadoArray);
  } catch (error) {
    console.error('Erro ao gerar fluxo de caixa:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar fluxo de caixa' },
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
