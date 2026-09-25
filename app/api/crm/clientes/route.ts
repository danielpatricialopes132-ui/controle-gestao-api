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
      const clientes = await prisma.cliente.findMany({
        orderBy: { nome: 'asc' },
        take: 100,
      });
      return NextResponse.json(clientes);
    }

    const clientes = await prisma.cliente.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
    });

    return NextResponse.json(clientes);
  } catch (error) {
    console.error('Error fetching clientes:', error);
    return NextResponse.json({ error: 'Failed to fetch clientes' }, { status: 500 });
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
    const { nome, cpfCnpj, telefone, email } = body;

    const novoCliente = await prisma.cliente.create({
      data: {
        nome,
        cpfCnpj,
        telefone,
        email,
        tenantId,
      },
    });

    return NextResponse.json(novoCliente, { status: 201 });
  } catch (error) {
    console.error('Error creating cliente:', error);
    return NextResponse.json({ error: 'Failed to create cliente' }, { status: 500 });
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
