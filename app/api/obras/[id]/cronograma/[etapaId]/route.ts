import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string, etapaId: string }> }) {
  try {
    const user = await verifyIdToken(request);
    const resolvedParams = await params;
    const { etapaId } = resolvedParams;

    const body = await request.json();
    const { percentualConclusao, dataFimReal } = body;

    const updateData: any = {};
    if (percentualConclusao !== undefined) updateData.percentualConclusao = parseFloat(percentualConclusao.toString());
    if (dataFimReal !== undefined) updateData.dataFimReal = dataFimReal ? new Date(dataFimReal) : null;

    const etapa = await prisma.etapaCronograma.update({
      where: {
        id: etapaId,
        tenantId: user.tenantId,
      },
      data: updateData,
    });

    return NextResponse.json(etapa);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string, etapaId: string }> }) {
  try {
    const user = await verifyIdToken(request);
    const resolvedParams = await params;
    const { etapaId } = resolvedParams;

    await prisma.etapaCronograma.delete({
      where: {
        id: etapaId,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
