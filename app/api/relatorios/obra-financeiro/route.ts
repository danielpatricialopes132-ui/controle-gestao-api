import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const { searchParams } = new URL(request.url);
    
    const obraId = searchParams.get('obraId');
    const periodo = searchParams.get('periodo'); // 'SEMANAL' ou 'MENSAL'
    const ano = searchParams.get('ano');
    const mes = searchParams.get('mes'); // 1 a 12 (opcional para mensal se quiser o ano todo, obrigatório para semanal)

    if (!obraId || !periodo || !ano) {
      return NextResponse.json({ success: false, error: 'obraId, periodo e ano são obrigatórios' }, { status: 400 });
    }

    const tenantId = userAuth.tenantId;

    // Verificar se a obra pertence ao tenant
    const obra = await prisma.obra.findUnique({
      where: { id: obraId, tenantId },
      include: { contrato: true }
    });

    if (!obra) {
      return NextResponse.json({ success: false, error: 'Obra não encontrada' }, { status: 404 });
    }

    // Definir range de datas
    let dateStart: Date;
    let dateEnd: Date;
    
    const anoNum = parseInt(ano);
    
    if (mes) {
      const mesNum = parseInt(mes);
      dateStart = new Date(anoNum, mesNum - 1, 1);
      dateEnd = new Date(anoNum, mesNum, 0, 23, 59, 59, 999);
    } else {
      dateStart = new Date(anoNum, 0, 1);
      dateEnd = new Date(anoNum, 11, 31, 23, 59, 59, 999);
    }

    // Buscar transações
    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId,
        obraId,
        status: 'PAGO',
        dataPagamento: {
          gte: dateStart,
          lte: dateEnd
        }
      },
      orderBy: { dataPagamento: 'asc' }
    });

    // Agrupar (simples para mensal, semanas para semanal)
    const agrupamento: Record<string, { receitas: number, despesas: number, saldo: number }> = {};
    let totalReceitas = 0;
    let totalDespesas = 0;

    transacoes.forEach(t => {
      if (!t.dataPagamento) return;
      
      let chave = '';
      if (periodo === 'MENSAL') {
        chave = `${t.dataPagamento.getFullYear()}-${String(t.dataPagamento.getMonth() + 1).padStart(2, '0')}`;
      } else {
        // Lógica simples de semana do mês
        const dia = t.dataPagamento.getDate();
        const semana = Math.ceil(dia / 7);
        chave = `Semana ${semana > 4 ? 4 : semana}`; 
      }

      if (!agrupamento[chave]) {
        agrupamento[chave] = { receitas: 0, despesas: 0, saldo: 0 };
      }

      const valor = Number(t.valor);
      if (t.tipo === 'RECEITA') {
        agrupamento[chave].receitas += valor;
        totalReceitas += valor;
      } else {
        agrupamento[chave].despesas += valor;
        totalDespesas += valor;
      }
      agrupamento[chave].saldo = agrupamento[chave].receitas - agrupamento[chave].despesas;
    });

    return NextResponse.json({
      success: true,
      data: {
        obra: obra.nome,
        contratoValor: obra.contrato ? Number(obra.contrato.valor) : 0,
        resumoPeriodo: {
          totalReceitas,
          totalDespesas,
          saldo: totalReceitas - totalDespesas
        },
        agrupamento
      }
    });

  } catch (error: any) {
    console.error('Erro na Evolução Financeira Obra API:', error);
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
