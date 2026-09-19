import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');

    const filter: any = { tenantId };
    if (tipo) {
      filter.tipoColaborador = tipo;
    }

    const funcionarios = await prisma.funcionario.findMany({
      where: filter,
      orderBy: { nome: 'asc' },
    });

    return NextResponse.json(funcionarios);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    const data = await request.json();
    const { nome, cargo, tipoColaborador, cpfCnpj, chavePix, salario, valorDiaria, valorDiariaMotorista, tipoPagamento } = data;

    if (!nome || !cargo) {
      return NextResponse.json({ error: 'nome e cargo são obrigatórios' }, { status: 400 });
    }

    const novoFuncionario = await prisma.funcionario.create({
      data: {
        tenantId,
        nome,
        cargo,
        tipoColaborador: tipoColaborador || 'CLT',
        cpfCnpj,
        chavePix,
        salario: salario ? parseFloat(salario) : null,
        valorDiaria: valorDiaria ? parseFloat(valorDiaria) : null,
        valorDiariaMotorista: valorDiariaMotorista ? parseFloat(valorDiariaMotorista) : null,
        tipoPagamento: tipoPagamento || 'MENSAL',
      },
    });

    return NextResponse.json({ success: true, data: novoFuncionario }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
