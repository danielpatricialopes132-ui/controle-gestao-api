import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

// GET: Lista os termos de retirada de materiais da obra
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

    const termos = await prisma.termoRetiradaItem.findMany({
      where: { obraId, tenantId: userAuth.tenantId },
      include: {
        terceiro: true,
      },
      orderBy: { dataRetirada: 'desc' },
    });

    return NextResponse.json(termos);
  } catch (error: any) {
    console.error('Erro ao listar termos de retirada:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// POST: Cria um novo termo de retirada de itens com assinatura digital
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

    const {
      terceiroClienteId,
      empresaRetirante,
      nomeResponsavelRetirada,
      documentoResponsavel,
      itensRetirados,
      motivoRetirada,
      previsaoDevolucao,
      assinaturaDigitalRetirante,
      assinaturaDigitalResponsavelObra,
      observacoes,
    } = body;

    if (!empresaRetirante || !nomeResponsavelRetirada || !itensRetirados || itensRetirados.length === 0) {
      return NextResponse.json(
        { error: 'Empresa, responsável e ao menos um item a retirar são obrigatórios.' },
        { status: 400 }
      );
    }

    // Gera número sequencial do termo
    const totalTermos = await prisma.termoRetiradaItem.count({
      where: { obraId, tenantId: userAuth.tenantId },
    });
    const anoAtual = new Date().getFullYear();
    const numeroTermo = `RET-${anoAtual}-${String(totalTermos + 1).padStart(3, '0')}`;

    const termo = await prisma.termoRetiradaItem.create({
      data: {
        obraId,
        tenantId: userAuth.tenantId,
        terceiroClienteId: terceiroClienteId || null,
        numeroTermo,
        empresaRetirante,
        nomeResponsavelRetirada,
        documentoResponsavel: documentoResponsavel || null,
        itensRetirados,
        motivoRetirada: motivoRetirada || 'USINAGEM_BANCADA',
        previsaoDevolucao: previsaoDevolucao ? new Date(previsaoDevolucao) : null,
        assinaturaDigitalRetirante: assinaturaDigitalRetirante || null,
        assinaturaDigitalResponsavelObra: assinaturaDigitalResponsavelObra || null,
        observacoes: observacoes || null,
        status: 'RETIRADO',
      },
      include: {
        terceiro: true,
      },
    });

    return NextResponse.json(termo, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar termo de retirada:', error);
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
