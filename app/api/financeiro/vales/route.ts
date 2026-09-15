import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    if (userAuth.role === 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a Tenants.' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;

    const vales = await prisma.vale.findMany({
      where: { tenantId },
      include: {
        funcionario: { select: { nome: true } },
        obra: { select: { nome: true } }
      },
      orderBy: { dataEmissao: 'desc' }
    });

    return NextResponse.json({ success: true, data: vales });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    if (userAuth.role === 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a Tenants.' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    
    if (!body.valor || !body.funcionarioId) {
      return NextResponse.json({ success: false, error: 'Valor e Funcionario são obrigatórios' }, { status: 400 });
    }

    const vale = await prisma.vale.create({
      data: {
        valor: parseFloat(body.valor),
        tipo: body.tipo || 'SALARIAL',
        descricao: body.descricao || null,
        status: body.status || 'ABERTO',
        funcionarioId: body.funcionarioId,
        obraId: body.obraId || null,
        tenantId: tenantId,
      }
    });

    return NextResponse.json({ success: true, data: vale });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}
