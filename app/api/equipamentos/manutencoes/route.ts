import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { equipamentoId, dataProgramada, descricao, custoEstimado, tenantId } = body;

    if (!tenantId || !equipamentoId || !dataProgramada || !descricao) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const novaManutencao = await prisma.manutencaoPreventiva.create({
      data: {
        equipamentoId,
        dataProgramada: new Date(dataProgramada),
        descricao,
        custoEstimado: custoEstimado || 0,
        tenantId,
      },
    });

    return NextResponse.json({ success: true, data: novaManutencao }, { status: 201 });
  } catch (error) {
    console.error('Erro ao agendar manutenção:', error);
    return NextResponse.json({ error: 'Erro ao agendar manutenção' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID da manutenção e status são obrigatórios' }, { status: 400 });
    }

    const manutencao = await prisma.manutencaoPreventiva.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, data: manutencao });
  } catch (error) {
    console.error('Erro ao atualizar manutenção:', error);
    return NextResponse.json({ error: 'Erro ao atualizar manutenção' }, { status: 500 });
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
