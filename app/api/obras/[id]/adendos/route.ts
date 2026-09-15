import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../../../lib/auth';
import { prisma } from '../../../../../../lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (userAuth.role === 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a Tenants.' }, { status: 403 });
    }
    const tenantId = userAuth.tenantId;

    const adendos = await prisma.adendoObra.findMany({
      where: { 
        tenantId,
        obraId: params.id
      },
      orderBy: { dataAprovacao: 'desc' }
    });

    return NextResponse.json({ success: true, data: adendos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (userAuth.role === 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a Tenants.' }, { status: 403 });
    }
    const tenantId = userAuth.tenantId;
    const body = await request.json();
    
    if (!body.descricao || !body.valor) {
      return NextResponse.json({ success: false, error: 'Descrição e Valor são obrigatórios' }, { status: 400 });
    }

    const adendo = await prisma.adendoObra.create({
      data: {
        descricao: body.descricao,
        valor: parseFloat(body.valor),
        dataAprovacao: body.dataAprovacao,
        obraId: params.id,
        tenantId: tenantId,
      }
    });

    return NextResponse.json({ success: true, data: adendo });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}
