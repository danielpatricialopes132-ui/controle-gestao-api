import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const equipamentos = await prisma.equipamento.findMany({
      where: { tenantId },
      include: {
        alocacoes: {
          include: { obra: true },
          orderBy: { dataInicio: 'desc' }
        },
        manutencoes: {
          orderBy: { dataProgramada: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(equipamentos);
  } catch (error) {
    console.error('Erro ao buscar equipamentos:', error);
    return NextResponse.json({ error: 'Erro ao buscar equipamentos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identificador, marca, modelo, ano, custoDiario, status, tenantId } = body;

    if (!tenantId || !identificador) {
      return NextResponse.json({ error: 'Tenant ID e Identificador são obrigatórios' }, { status: 400 });
    }

    const novoEquipamento = await prisma.equipamento.create({
      data: {
        identificador,
        marca,
        modelo,
        ano: ano ? parseInt(ano) : null,
        custoDiario: custoDiario || 0,
        status: status || 'DISPONIVEL',
        tenantId,
      },
    });

    return NextResponse.json({ success: true, data: novoEquipamento }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar equipamento:', error);
    return NextResponse.json({ error: 'Erro ao criar equipamento' }, { status: 500 });
  }
}
