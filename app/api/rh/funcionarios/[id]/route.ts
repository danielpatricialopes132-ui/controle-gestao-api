import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userAuth = await verifyIdToken(req);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = userAuth.tenantId;
    const body = await req.json();

    const { 
      nome,
      cargo,
      salario,
      valorDiariaMotorista
    } = body;

    const dataToUpdate: any = {};
    if (nome !== undefined) dataToUpdate.nome = nome;
    if (cargo !== undefined) dataToUpdate.cargo = cargo;
    
    // Se o frontend enviar, nós atualizamos (inclusive para null)
    if (salario !== undefined) {
      dataToUpdate.salario = salario ? Number(salario) : null;
    }
    if (valorDiariaMotorista !== undefined) {
      dataToUpdate.valorDiariaMotorista = valorDiariaMotorista ? Number(valorDiariaMotorista) : null;
    }

    const funcionario = await prisma.funcionario.updateMany({
      where: {
        id: id,
        tenantId,
      },
      data: dataToUpdate,
    });

    if (funcionario.count === 0) {
      return NextResponse.json({ error: 'Funcionário não encontrado ou não pertence a este tenant.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em PUT funcionario:', error);
    return NextResponse.json({ error: 'Erro ao atualizar funcionário', details: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userAuth = await verifyIdToken(req);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = userAuth.tenantId;

    const funcionario = await prisma.funcionario.deleteMany({
      where: {
        id: id,
        tenantId,
      },
    });

    if (funcionario.count === 0) {
      return NextResponse.json({ error: 'Funcionário não encontrado ou não pertence a este tenant.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro em DELETE funcionario:', error);
    return NextResponse.json({ error: 'Erro ao excluir funcionário', details: error.message }, { status: 500 });
  }
}
