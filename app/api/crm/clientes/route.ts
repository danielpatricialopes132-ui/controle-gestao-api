import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
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
    const tenantId = request.headers.get('x-tenant-id');
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
