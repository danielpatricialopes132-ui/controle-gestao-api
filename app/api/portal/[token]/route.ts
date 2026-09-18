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
          select: { nome: true }
        }
      },
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado ou token expirado' }, { status: 404 });
    }

    // Busca as obras vinculadas às propostas deste cliente (ou que pertençam ao tenant se tivermos outra modelagem)
    // Para simplificar, buscamos as obras cujas propostas pertencem ao cliente.
    const propostasIds = cliente.propostas.map(p => p.id);
    
    const obras = await prisma.obra.findMany({
      where: {
        propostaId: { in: propostasIds },
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
        }
      }
    });

    return NextResponse.json({
      cliente: {
        nome: cliente.nome,
        cpfCnpj: cliente.cpfCnpj,
      },
      empresa: cliente.tenant.nome,
      propostas: cliente.propostas,
      obras: obras,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
