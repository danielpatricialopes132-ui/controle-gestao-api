import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    let tenantId = request.headers.get('x-tenant-id');

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
      const propostas = await prisma.proposta.findMany({
        include: {
          cliente: true,
          itens: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return NextResponse.json(propostas);
    }

    const propostas = await prisma.proposta.findMany({
      where: { tenantId },
      include: {
        cliente: true,
        itens: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(propostas);
  } catch (error) {
    console.error('Error fetching propostas:', error);
    return NextResponse.json({ error: 'Failed to fetch propostas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let tenantId = request.headers.get('x-tenant-id');

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const userAuth = await verifyIdToken(request);
      if (userAuth) {
        const tenantOverride = request.headers.get('x-tenant-override');
        tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;
      }
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { titulo, clienteId, valorTotal, validadeDias, termos, itens } = body;

    const novaProposta = await prisma.proposta.create({
      data: {
        titulo,
        clienteId,
        tenantId,
        valorTotal,
        validadeDias,
        termos,
        status: 'RASCUNHO',
        itens: {
          create: itens.map((item: any) => ({
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.quantidade * item.valorUnitario,
          })),
        },
      },
      include: {
        cliente: true,
        itens: true,
      },
    });

    return NextResponse.json(novaProposta, { status: 201 });
  } catch (error) {
    console.error('Error creating proposta:', error);
    return NextResponse.json({ error: 'Failed to create proposta' }, { status: 500 });
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
