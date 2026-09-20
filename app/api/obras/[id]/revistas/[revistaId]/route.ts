import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; revistaId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId, revistaId } = await params;

    const revista = await prisma.revistaObra.findFirst({
      where: {
        id: revistaId,
        obraId,
        tenantId: userAuth.tenantId,
      },
      include: {
        obra: {
          include: {
            proposta: {
              include: {
                cliente: true,
              }
            },
            etapasCronograma: {
              orderBy: { dataInicioEstimada: 'asc' }
            }
          }
        },
        tenant: {
          select: {
            nome: true,
            logoUrl: true,
            corPrimaria: true,
          }
        }
      }
    });

    if (!revista) {
      return NextResponse.json({ error: 'Revista não encontrada' }, { status: 404 });
    }

    return NextResponse.json(revista);
  } catch (error: any) {
    console.error('Erro ao buscar revista:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados da revista' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; revistaId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId, revistaId } = await params;
    const body = await request.json();

    const atualizada = await prisma.revistaObra.updateMany({
      where: {
        id: revistaId,
        obraId,
        tenantId: userAuth.tenantId,
      },
      data: {
        titulo: body.titulo,
        editorial: body.editorial,
        destaques: body.destaques,
        lookahead: body.lookahead,
        capaUrl: body.capaUrl,
        fotosSelecionadas: body.fotosSelecionadas,
        status: body.status,
      }
    });

    return NextResponse.json({ success: true, count: atualizada.count });
  } catch (error: any) {
    console.error('Erro ao atualizar revista:', error);
    return NextResponse.json({ error: 'Erro ao atualizar revista' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; revistaId: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId, revistaId } = await params;

    await prisma.revistaObra.deleteMany({
      where: {
        id: revistaId,
        obraId,
        tenantId: userAuth.tenantId,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar revista:', error);
    return NextResponse.json({ error: 'Erro ao excluir revista' }, { status: 500 });
  }
}
