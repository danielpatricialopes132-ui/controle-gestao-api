import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const resolvedParams = await params;
    const { token } = resolvedParams;

    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { tokenPortal: token },
      include: {
        propostas: {
          orderBy: { createdAt: 'desc' },
        },
        tenant: {
          select: { nome: true, logoUrl: true, corPrimaria: true }
        }
      },
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado ou token expirado' }, { status: 404 });
    }

    // Busca as obras vinculadas às propostas deste cliente (ou que pertençam ao tenant se tivermos outra modelagem)
    const propostasIds = cliente.propostas.map(p => p.id);
    
    const obras = await prisma.obra.findMany({
      where: {
        OR: [
          { propostaId: { in: propostasIds } },
          { clienteId: cliente.id },
        ],
      },
      include: {
        etapasCronograma: {
          orderBy: { dataInicioEstimada: 'asc' },
        },
        fotos: {
          orderBy: { createdAt: 'desc' },
        },
        documentos: {
          orderBy: { createdAt: 'desc' },
        },
        revistas: {
          where: { status: 'PUBLICADA' },
          orderBy: { dataFim: 'desc' },
        },
      }
    });

    return NextResponse.json({
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        cpfCnpj: cliente.cpfCnpj,
      },
      empresa: {
        nome: cliente.tenant.nome,
        logoUrl: (cliente.tenant as any).logoUrl || null,
        corPrimaria: (cliente.tenant as any).corPrimaria || '#0f766e',
      },
      propostas: cliente.propostas,
      obras: obras,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
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
