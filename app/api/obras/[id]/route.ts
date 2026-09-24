import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken, registrarLog } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userAuth = await verifyIdToken(req);
    const tenantId = userAuth.tenantId;
    const { id } = await params;
    const body = await req.json();

    const { nome, endereco, status } = body;

    const obraExistente = await prisma.obra.findFirst({
      where: { id, tenantId },
    });

    if (!obraExistente) {
      return NextResponse.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    const obra = await prisma.obra.update({
      where: { id },
      data: {
        nome,
        endereco,
        status,
      },
    });

    await registrarLog(userAuth.dbId, tenantId, 'EDITAR_OBRA', 'OBRAS', {
      obraId: id,
      dadosAnteriores: { nome: obraExistente.nome, endereco: obraExistente.endereco, status: obraExistente.status },
      dadosNovos: { nome, endereco, status }
    });

    return NextResponse.json({ success: true, data: obra });
  } catch (error: any) {
    console.error('Erro em PUT obra:', error);
    return NextResponse.json({ error: 'Erro ao atualizar obra', details: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userAuth = await verifyIdToken(req);
    const tenantId = userAuth.tenantId;
    const { id } = await params;

    const obraExistente = await prisma.obra.findFirst({
      where: { id, tenantId },
    });

    if (!obraExistente) {
      return NextResponse.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    await prisma.obra.delete({
      where: { id },
    });

    await registrarLog(userAuth.dbId, tenantId, 'EXCLUIR_OBRA', 'OBRAS', {
      obraId: id,
      nomeObra: obraExistente.nome
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em DELETE obra:', error);
    return NextResponse.json({ error: 'Erro ao excluir obra', details: error.message }, { status: 500 });
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
