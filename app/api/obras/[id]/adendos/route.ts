import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const decodedToken = await verifyIdToken(request);
    
    const usuario = await prisma.usuario.findUnique({
      where: { firebaseUid: decodedToken.uid },
    });

    if (!usuario) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });
    }

    let targetTenantId = decodedToken.tenantId;

    const { id: obraId  } = await params;
    
    // Validar obra
    const obra = await prisma.obra.findFirst({
      where: { id: obraId, tenantId: targetTenantId },
      include: { contrato: true }
    });

    if (!obra) {
      return NextResponse.json({ success: false, error: 'Obra não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { descricao, valor, dataAssinatura } = body;

    if (!descricao || valor === undefined) {
      return NextResponse.json({ success: false, error: 'Descrição e valor são obrigatórios' }, { status: 400 });
    }

    // Se a obra ainda não tem contrato principal, criaremos um contrato "fake" para atrelar o adendo,
    // ou exigimos que o contrato seja criado antes. Vamos simplificar e criar um dinamicamente se faltar.
    let contratoId = obra.contrato?.id;
    if (!contratoId) {
      const novoContrato = await prisma.contrato.create({
        data: {
          descricao: 'Contrato Principal (Automático)',
          valor: 0,
          obraId: obra.id,
          tenantId: targetTenantId,
        }
      });
      contratoId = novoContrato.id;
    }

    const adendo = await prisma.adendo.create({
      data: {
        descricao,
        valor: parseFloat(valor.toString()),
        dataAssinatura: dataAssinatura ? new Date(dataAssinatura) : new Date(),
        contratoId,
        tenantId: targetTenantId,
      }
    });

    return NextResponse.json({
      success: true,
      data: adendo
    });

  } catch (error) {
    console.error('Erro em POST /api/obras/[id]/adendos:', error);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
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
