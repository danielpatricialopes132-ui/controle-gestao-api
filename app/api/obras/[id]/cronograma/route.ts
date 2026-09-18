import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyIdToken(request);
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const etapas = await prisma.etapaCronograma.findMany({
      where: {
        obraId: id,
        tenantId: user.tenantId,
      },
      orderBy: { dataInicioEstimada: 'asc' },
    });

    return NextResponse.json(etapas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyIdToken(request);
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await request.json();
    const { nome, dataInicioEstimada, dataFimEstimada, custoPrevisto, percentualConclusao } = body;

    const etapa = await prisma.etapaCronograma.create({
      data: {
        nome,
        dataInicioEstimada: new Date(dataInicioEstimada),
        dataFimEstimada: new Date(dataFimEstimada),
        custoPrevisto: custoPrevisto ? parseFloat(custoPrevisto.toString()) : 0,
        percentualConclusao: percentualConclusao ? parseFloat(percentualConclusao.toString()) : 0,
        obraId: id,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json(etapa);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
