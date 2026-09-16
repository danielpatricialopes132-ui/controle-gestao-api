import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyAuth(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;

    const categorias = await prisma.categoriaFinanceira.findMany({
      where: { tenantId },
      orderBy: { codigo: 'asc' },
    });

    return NextResponse.json(categorias);
  } catch (error: any) {
    console.error('Erro ao listar categorias financeiras:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyAuth(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;
    const { codigo, descricao, tipo } = await request.json();

    if (!codigo || !descricao || !tipo) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Verificar se já existe o código no tenant
    const existente = await prisma.categoriaFinanceira.findUnique({
      where: {
        tenantId_codigo: { tenantId, codigo }
      }
    });

    if (existente) {
      return NextResponse.json({ error: 'Código já existe' }, { status: 400 });
    }

    const novaCategoria = await prisma.categoriaFinanceira.create({
      data: {
        codigo,
        descricao,
        tipo,
        tenantId
      }
    });

    return NextResponse.json(novaCategoria, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar categoria financeira:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
