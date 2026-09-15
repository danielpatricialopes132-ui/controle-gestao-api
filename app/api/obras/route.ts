import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);

    // Se MASTER, não deveria ver obras específicas a menos que passe um tenantId por query, 
    // mas por segurança e escopo atual, retornaremos erro ou obras globais (vazio por padrão).
    // Para simplificar, o MASTER deve agir como tenant ou bloquear a rota.
    if (userAuth.role === 'MASTER') {
      return NextResponse.json({ success: false, error: 'Funcionalidade restrita a Tenants.' }, { status: 403 });
    }

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

    if (userAuth.role === 'MASTER') {
      return NextResponse.json({ success: false, error: 'Apenas empresas podem cadastrar obras.' }, { status: 403 });
    }

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

    return NextResponse.json({ success: true, data: obra });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}
