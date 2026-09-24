import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { nome, cpfCnpj, telefone, email } = body;

    const clienteAtualizado = await prisma.cliente.updateMany({
      where: {
        id: (await params).id,
        tenantId,
      },
      data: {
        nome,
        cpfCnpj,
        telefone,
        email,
      },
    });

    if (clienteAtualizado.count === 0) {
      return NextResponse.json({ error: 'Cliente not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Cliente updated successfully' });
  } catch (error) {
    console.error('Error updating cliente:', error);
    return NextResponse.json({ error: 'Failed to update cliente' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const clienteDeletado = await prisma.cliente.deleteMany({
      where: {
        id: (await params).id,
        tenantId,
      },
    });

    if (clienteDeletado.count === 0) {
      return NextResponse.json({ error: 'Cliente not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Cliente deleted successfully' });
  } catch (error) {
    console.error('Error deleting cliente:', error);
    return NextResponse.json({ error: 'Failed to delete cliente' }, { status: 500 });
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
