import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (!userAuth || !userAuth.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    const tenantId = userAuth.tenantId;

    const { searchParams } = new URL(request.url);
    const obraId = searchParams.get('obraId');
    
    const where: any = { tenantId };
    if (obraId) {
      where.obraId = obraId;
    }

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where,
      include: {
        obra: true,
        planoConta: true
      },
      orderBy: { dataVencimento: 'desc' }
    });

    let totalReceitas = 0;
    let totalDespesas = 0;

    transacoes.forEach((t: any) => {
      if (t.tipo === 'RECEITA') {
        totalReceitas += t.valor;
      } else {
        totalDespesas += t.valor;
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        totalReceitas,
        totalDespesas,
        saldo: totalReceitas - totalDespesas,
        transacoes
      } 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}


