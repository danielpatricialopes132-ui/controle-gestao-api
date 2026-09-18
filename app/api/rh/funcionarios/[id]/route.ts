import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = await request.json();
    const { nome, cargo, tipoColaborador, cpfCnpj, chavePix, salario, valorDiaria, valorDiariaMotorista, tipoPagamento } = data;

    const funcionario = await prisma.funcionario.update({
      where: { id },
      data: {
        nome,
        cargo,
        tipoColaborador,
        cpfCnpj,
        chavePix,
        salario: salario ? parseFloat(salario) : null,
        valorDiaria: valorDiaria ? parseFloat(valorDiaria) : null,
        valorDiariaMotorista: valorDiariaMotorista ? parseFloat(valorDiariaMotorista) : null,
        tipoPagamento,
      },
    });

    return NextResponse.json({ success: true, data: funcionario });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    await prisma.funcionario.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
