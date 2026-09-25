import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let tenantId = searchParams.get('tenantId') || request.headers.get('x-tenant-id');

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const userAuth = await verifyIdToken(request);
      if (userAuth) {
        const tenantOverride = request.headers.get('x-tenant-override');
        tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;
      }
    }

    if (!tenantId) {
      // Se for MASTER e ainda não selecionou tenant (Painel Global), traz todos
      const equipamentos = await prisma.equipamento.findMany({
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
        take: 100,
      });
      return NextResponse.json(equipamentos);
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
    let { identificador, marca, modelo, ano, custoDiario, status, tenantId } = body;

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const userAuth = await verifyIdToken(request);
      if (userAuth) {
        const tenantOverride = request.headers.get('x-tenant-override');
        tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : (tenantId || userAuth.tenantId);
      }
    }

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
