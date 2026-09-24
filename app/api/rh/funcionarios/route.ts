import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const fornecedorId = searchParams.get('fornecedorId');

    const filter: any = { tenantId };
    if (tipo) {
      filter.tipoColaborador = tipo;
    }
    if (fornecedorId) {
      filter.fornecedorId = fornecedorId;
    }

    const funcionarios = await prisma.funcionario.findMany({
      where: filter,
      include: {
        fornecedor: {
          include: {
            empreiteiroPai: true,
          }
        }
      },
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
    const { nome, cargo, tipoColaborador, cpfCnpj, chavePix, salario, valorDiaria, valorDiariaMotorista, tipoPagamento, fornecedorId } = data;

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
        fornecedorId: fornecedorId || null,
      },
      include: {
        fornecedor: true,
      }
    });

    return NextResponse.json({ success: true, data: novoFuncionario }, { status: 201 });
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
