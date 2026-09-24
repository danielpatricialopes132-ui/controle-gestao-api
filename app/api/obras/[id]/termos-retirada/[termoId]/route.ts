import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

// PATCH: Registra devolução ou atualiza status do termo de retirada
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; termoId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { termoId } = await params;
    const body = await request.json();

    const termo = await prisma.termoRetiradaItem.update({
      where: { id: termoId, tenantId: userAuth.tenantId },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.dataDevolucaoReal !== undefined && {
          dataDevolucaoReal: body.dataDevolucaoReal ? new Date(body.dataDevolucaoReal) : null,
        }),
        ...(body.observacoes !== undefined && { observacoes: body.observacoes }),
      },
      include: {
        terceiro: true,
      },
    });

    return NextResponse.json(termo);
  } catch (error: any) {
    console.error('Erro ao atualizar termo de retirada:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// DELETE: Exclui termo de retirada
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; termoId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { termoId } = await params;

    await prisma.termoRetiradaItem.delete({
      where: { id: termoId, tenantId: userAuth.tenantId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao excluir termo de retirada:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
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
