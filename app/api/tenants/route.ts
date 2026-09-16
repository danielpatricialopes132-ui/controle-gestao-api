import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    if (userAuth.role !== 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a SUPER ADMINS.' }, { status: 403 });
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { nome: 'asc' }
    });

    return NextResponse.json({ success: true, data: tenants });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    if (userAuth.role !== 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a SUPER ADMINS.' }, { status: 403 });
    }

    const body = await request.json();
    
    if (!body.nome || !body.documento) {
      return NextResponse.json({ success: false, error: 'Nome e Documento são obrigatórios' }, { status: 400 });
    }

    const tenant = await prisma.tenant.create({
      data: {
        nome: body.nome,
        documento: body.documento,
      }
    });

    // TODO: Criar o Plano de Contas padrão para essa nova empresa

    return NextResponse.json({ success: true, data: tenant });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

