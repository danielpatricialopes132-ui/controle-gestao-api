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
    const { titulo, valorTotal, validadeDias, termos, status, nfUrl } = body;

    // Busca a proposta antes para verificar o status antigo
    const propostaAnterior = await prisma.proposta.findUnique({
      where: { id: (await params).id, tenantId },
      include: { cliente: true },
    });

    if (!propostaAnterior) {
      return NextResponse.json({ error: 'Proposta not found' }, { status: 404 });
    }

    const propostaAtualizada = await prisma.proposta.update({
      where: {
        id: (await params).id,
      },
      data: {
        titulo,
        valorTotal,
        validadeDias,
        termos,
        status,
        nfUrl,
      },
    });

    // Automação: Se mudou para APROVADA, e não tinha obra, cria a Obra!
    if (status === 'APROVADA' && propostaAnterior.status !== 'APROVADA') {
      const obraJaExiste = await prisma.obra.findUnique({ where: { propostaId: (await params).id } });
      
      if (!obraJaExiste) {
        await prisma.obra.create({
          data: {
            nome: `Obra: ${propostaAnterior.cliente.nome} - ${propostaAtualizada.titulo}`,
            tenantId,
            status: 'EM_ANDAMENTO',
            propostaId: (await params).id,
          }
        });
      }
    }

    return NextResponse.json(propostaAtualizada);
  } catch (error) {
    console.error('Error updating proposta:', error);
    return NextResponse.json({ error: 'Failed to update proposta' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const propostaDeletada = await prisma.proposta.deleteMany({
      where: {
        id: (await params).id,
        tenantId,
      },
    });

    if (propostaDeletada.count === 0) {
      return NextResponse.json({ error: 'Proposta not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Proposta deleted successfully' });
  } catch (error) {
    console.error('Error deleting proposta:', error);
    return NextResponse.json({ error: 'Failed to delete proposta' }, { status: 500 });
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
