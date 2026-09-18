import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { identificador, marca, modelo, ano, custoDiario, status } = body;

    const equipamento = await prisma.equipamento.update({
      where: { id },
      data: {
        ...(identificador && { identificador }),
        ...(marca && { marca }),
        ...(modelo && { modelo }),
        ...(ano !== undefined && { ano: ano ? parseInt(ano) : null }),
        ...(custoDiario !== undefined && { custoDiario }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({ success: true, data: equipamento });
  } catch (error) {
    console.error('Erro ao atualizar equipamento:', error);
    return NextResponse.json({ error: 'Erro ao atualizar equipamento' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    await prisma.equipamento.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir equipamento:', error);
    return NextResponse.json({ error: 'Erro ao excluir equipamento' }, { status: 500 });
  }
}
