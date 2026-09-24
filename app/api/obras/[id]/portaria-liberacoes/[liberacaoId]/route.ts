import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

// PATCH: Atualiza o status ou dados da liberação de portaria
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; liberacaoId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { liberacaoId } = await params;
    const body = await request.json();

    const autorizacao = await prisma.autorizacaoAcessoPortaria.update({
      where: { id: liberacaoId, tenantId: userAuth.tenantId },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.observacoes !== undefined && { observacoes: body.observacoes }),
        ...(body.regrasCondominio !== undefined && { regrasCondominio: body.regrasCondominio }),
        ...(body.horarioPermitido !== undefined && { horarioPermitido: body.horarioPermitido }),
      },
    });

    return NextResponse.json(autorizacao);
  } catch (error: any) {
    console.error('Erro ao atualizar liberação de portaria:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// DELETE: Exclui a liberação de portaria
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; liberacaoId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { liberacaoId } = await params;

    await prisma.autorizacaoAcessoPortaria.delete({
      where: { id: liberacaoId, tenantId: userAuth.tenantId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao excluir liberação de portaria:', error);
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
