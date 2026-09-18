import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    const tenantId = userAuth.tenantId;

    const obras = await prisma.obra.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: obras });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    
    if (!body.nome) {
      return NextResponse.json({ success: false, error: 'Nome da obra é obrigatório' }, { status: 400 });
    }

    const obra = await prisma.obra.create({
      data: {
        nome: body.nome,
        endereco: body.endereco || null,
        status: body.status || 'EM_ANDAMENTO',
        tenantId: tenantId,
      }
    });

    // Criação automática do Estoque/Almoxarifado vinculado à Obra
    await prisma.estoque.create({
      data: {
        nome: `Almoxarifado - ${obra.nome}`,
        obraId: obra.id,
        tenantId: tenantId,
      }
    });

    return NextResponse.json({ success: true, data: obra });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

