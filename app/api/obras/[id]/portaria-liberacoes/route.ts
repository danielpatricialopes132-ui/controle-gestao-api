import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

// GET: Retorna as autorizações de acesso para a portaria/condomínio da obra
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

    const autorizacoes = await prisma.autorizacaoAcessoPortaria.findMany({
      where: { obraId, tenantId: userAuth.tenantId },
      include: {
        terceiro: true,
      },
      orderBy: { dataInicio: 'desc' },
    });

    return NextResponse.json(autorizacoes);
  } catch (error: any) {
    console.error('Erro ao listar liberações de portaria:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// POST: Cria uma nova autorização de liberação de entrada na portaria
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
      tipoAcesso,
      empresaNome,
      veiculoPlaca,
      veiculoModelo,
      dataInicio,
      dataFim,
      horarioPermitido,
      colaboradores,
      regrasCondominio,
      observacoes,
    } = body;

    if (!empresaNome || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: 'Nome da empresa, data de início e término são obrigatórios.' },
        { status: 400 }
      );
    }

    const autorizacao = await prisma.autorizacaoAcessoPortaria.create({
      data: {
        obraId,
        tenantId: userAuth.tenantId,
        terceiroClienteId: terceiroClienteId || null,
        tipoAcesso: tipoAcesso || 'TERCEIRO_CLIENTE',
        empresaNome,
        veiculoPlaca: veiculoPlaca || null,
        veiculoModelo: veiculoModelo || null,
        dataInicio: new Date(dataInicio),
        dataFim: new Date(dataFim),
        horarioPermitido: horarioPermitido || '08:00 às 17:00 (Segunda a Sexta)',
        colaboradores: colaboradores || [],
        regrasCondominio: regrasCondominio || null,
        observacoes: observacoes || null,
        status: 'AUTORIZADO',
      },
      include: {
        terceiro: true,
      },
    });

    return NextResponse.json(autorizacao, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar liberação de portaria:', error);
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
