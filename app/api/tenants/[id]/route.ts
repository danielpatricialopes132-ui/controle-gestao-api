import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, registrarLog } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    const { id } = await params;

    if (userAuth.role !== 'MASTER' && userAuth.tenantId !== id) {
      return NextResponse.json({ success: false, error: 'Acesso negado.' }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        categoriasFinanceiras: {
          orderBy: { codigo: 'asc' },
        },
        _count: {
          select: {
            usuarios: true,
            obras: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Empresa não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: tenant });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    const { id } = await params;

    // Apenas MASTER ou ADMIN da própria empresa
    if (userAuth.role !== 'MASTER' && (userAuth.role !== 'ADMIN' || userAuth.tenantId !== id)) {
      return NextResponse.json({ success: false, error: 'Permissão insuficiente.' }, { status: 403 });
    }

    const body = await request.json();
    const { nome, documento, logoUrl, corPrimaria } = body;

    const tenantAtual = await prisma.tenant.findUnique({ where: { id } });
    if (!tenantAtual) {
      return NextResponse.json({ success: false, error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const tenantAtualizado = await prisma.tenant.update({
      where: { id },
      data: {
        nome: nome || undefined,
        documento: documento || undefined,
        logoUrl: logoUrl !== undefined ? logoUrl : undefined,
        corPrimaria: corPrimaria !== undefined ? corPrimaria : undefined,
      },
    });

    await registrarLog(userAuth.dbId, id, 'ATUALIZAR_TENANT', 'SISTEMA', {
      tenantId: id,
      alteracoes: {
        nome: nome !== tenantAtual.nome ? { de: tenantAtual.nome, para: nome } : undefined,
        documento: documento !== tenantAtual.documento ? { de: tenantAtual.documento, para: documento } : undefined,
        logoUrlAlterada: logoUrl !== tenantAtual.logoUrl,
        corPrimaria: corPrimaria !== tenantAtual.corPrimaria ? corPrimaria : undefined,
      },
    });

    return NextResponse.json({ success: true, data: tenantAtualizado });
  } catch (error: any) {
    console.error('Erro em PUT /api/tenants/[id]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
