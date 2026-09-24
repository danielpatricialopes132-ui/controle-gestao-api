import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userAuth = await verifyIdToken(request);

    if (userAuth.role !== 'MASTER' && userAuth.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito a Administradores e Masters.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const modulo = searchParams.get('modulo') || undefined;
    const acao = searchParams.get('acao') || undefined;
    const usuarioId = searchParams.get('usuarioId') || undefined;
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const paramTenantId = searchParams.get('tenantId');

    // Se for MASTER, pode filtrar por qualquer tenant ou ver todos se passar vazio.
    // Se for ADMIN comum, é estritamente restrito ao seu próprio tenant.
    let filterTenantId: string | undefined = userAuth.tenantId;
    if (userAuth.role === 'MASTER') {
      filterTenantId = paramTenantId || undefined;
    }

    const where: any = {};

    if (filterTenantId) {
      where.tenantId = filterTenantId;
    }

    if (modulo && modulo !== 'TODOS') {
      where.modulo = modulo;
    }

    if (acao) {
      where.acao = { contains: acao, mode: 'insensitive' };
    }

    if (usuarioId) {
      where.usuarioId = usuarioId;
    }

    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) {
        where.createdAt.gte = new Date(dataInicio);
      }
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        where.createdAt.lte = fim;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.logAuditoria.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              role: true,
            },
          },
          tenant: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.logAuditoria.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Erro ao consultar logs de auditoria:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
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
