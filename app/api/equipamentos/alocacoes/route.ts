import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { equipamentoId, obraId, dataInicio, tenantId } = body;

    if (!tenantId || !equipamentoId || !obraId || !dataInicio) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    // Criar a alocação
    const novaAlocacao = await prisma.alocacaoEquipamento.create({
      data: {
        equipamentoId,
        obraId,
        dataInicio: new Date(dataInicio),
        tenantId,
      },
    });

    // Atualizar o status do equipamento para ALOCADO
    await prisma.equipamento.update({
      where: { id: equipamentoId },
      data: { status: 'ALOCADO' },
    });

    return NextResponse.json({ success: true, data: novaAlocacao }, { status: 201 });
  } catch (error) {
    console.error('Erro ao alocar equipamento:', error);
    return NextResponse.json({ error: 'Erro ao alocar equipamento' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, dataFim } = body; // id da alocação

    if (!id || !dataFim) {
      return NextResponse.json({ error: 'ID da alocação e data de fim são obrigatórios' }, { status: 400 });
    }

    const alocacao = await prisma.alocacaoEquipamento.findUnique({
      where: { id },
      include: { equipamento: true },
    });

    if (!alocacao) {
      return NextResponse.json({ error: 'Alocação não encontrada' }, { status: 404 });
    }

    // Calcular dias
    const inicio = new Date(alocacao.dataInicio);
    const fim = new Date(dataFim);
    const diffTime = Math.abs(fim.getTime() - inicio.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // Mínimo de 1 dia
    
    const custoGerado = Number(alocacao.equipamento.custoDiario) * diffDays;

    // Atualizar alocação
    const alocacaoAtualizada = await prisma.alocacaoEquipamento.update({
      where: { id },
      data: {
        dataFim: fim,
        custoTotalGerado: custoGerado,
      },
    });

    // Liberar equipamento
    await prisma.equipamento.update({
      where: { id: alocacao.equipamentoId },
      data: { status: 'DISPONIVEL' },
    });

    // O custo serve apenas como indicador gerencial para a obra, não criamos despesa no livro caixa
    return NextResponse.json({ success: true, data: alocacaoAtualizada });
  } catch (error) {
    console.error('Erro ao finalizar alocação:', error);
    return NextResponse.json({ error: 'Erro ao finalizar alocação' }, { status: 500 });
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
