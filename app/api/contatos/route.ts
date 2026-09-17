import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (!userAuth || !userAuth.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    const tenantId = userAuth.tenantId;

    const contatos = await prisma.contato.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' }
    });

    return NextResponse.json({ success: true, data: contatos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (!userAuth || !userAuth.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    const tenantId = userAuth.tenantId;
    const body = await request.json();
    
    if (!body.nome) {
      return NextResponse.json({ success: false, error: 'Nome é obrigatório' }, { status: 400 });
    }

    const contato = await prisma.contato.create({
      data: {
        nome: body.nome,
        telefone: body.telefone,
        email: body.email,
        especialidade: body.especialidade,
        empresa: body.empresa,
        tenantId: tenantId,
      }
    });

    return NextResponse.json({ success: true, data: contato });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}


