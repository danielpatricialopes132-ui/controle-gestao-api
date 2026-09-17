import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    const tenantId = userAuth.tenantId;

    const vales = await prisma.transacaoFinanceira.findMany({
      where: { 
        tenantId,
        categoria: 'PESSOAL'
      },
      include: {
        funcionario: { select: { nome: true } },
        obra: { select: { nome: true } }
      },
      orderBy: { dataVencimento: 'desc' }
    });

    return NextResponse.json({ success: true, data: vales });
  } catch (error: any) {
    console.error('Erro em GET vales:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    
    if (!body.valor || !body.funcionarioId) {
      return NextResponse.json({ success: false, error: 'Valor e Funcionario são obrigatórios' }, { status: 400 });
    }

    const vale = await prisma.transacaoFinanceira.create({
      data: {
        valor: parseFloat(body.valor),
        tipo: 'DESPESA',
        categoria: 'PESSOAL',
        descricao: body.descricao || 'Adiantamento / Vale',
        status: body.status || 'PENDENTE',
        funcionarioId: body.funcionarioId,
        obraId: body.obraId || null,
        tenantId: tenantId,
      }
    });

    return NextResponse.json({ success: true, data: vale });
  } catch (error: any) {
    console.error('Erro em POST vales:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}


