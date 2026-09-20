import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId } = await params;

    const itens = await prisma.punchListItem.findMany({
      where: { obraId, tenantId: userAuth.tenantId },
      include: {
        terceiro: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(itens);
  } catch (error: any) {
    console.error('Erro ao buscar punch list:', error);
    return NextResponse.json({ error: 'Erro ao buscar itens de vistoria' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId } = await params;
    const body = await request.json();

    const novo = await prisma.punchListItem.create({
      data: {
        tenantId: userAuth.tenantId,
        obraId,
        terceiroClienteId: body.terceiroClienteId || null,
        ambiente: body.ambiente,
        descricao: body.descricao,
        fotoUrl: body.fotoUrl || null,
        status: body.status || 'PENDENTE',
        prazoCorrecao: body.prazoCorrecao ? new Date(body.prazoCorrecao) : null,
      }
    });

    return NextResponse.json(novo, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar item de punch list:', error);
    return NextResponse.json({ error: 'Erro ao registrar pendência de vistoria' }, { status: 500 });
  }
}
