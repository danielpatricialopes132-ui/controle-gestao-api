import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    const { id } = await context.params;
    
    // Verifica se pertence ao tenant
    const funcExistente = await prisma.funcionario.findFirst({ where: { id, tenantId } });
    if (!funcExistente) {
      return NextResponse.json({ error: 'Funcionario não encontrado ou sem permissão' }, { status: 404 });
    }

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
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    const { id } = await context.params;

    const funcExistente = await prisma.funcionario.findFirst({ where: { id, tenantId } });
    if (!funcExistente) {
      return NextResponse.json({ error: 'Funcionario não encontrado ou sem permissão' }, { status: 404 });
    }

    await prisma.funcionario.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
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
