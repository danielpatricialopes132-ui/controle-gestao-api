import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Lista itens de um estoque específico
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const { id } = await params;

    const itens = await prisma.estoqueItem.findMany({
      where: { estoqueId: id, tenantId },
      include: {
        produto: true
      },
      orderBy: { produto: { nome: 'asc' } }
    });

    return NextResponse.json({ success: true, data: itens });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Dar baixa manual ou entrada em um item do estoque
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const { id } = await params;
    const body = await request.json();

    const { produtoId, quantidade, tipo } = body; // tipo: 'ENTRADA' ou 'SAIDA'

    if (!produtoId || quantidade === undefined || !tipo) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const incremento = tipo === 'SAIDA' ? -quantidade : quantidade;

    const estoqueItem = await prisma.estoqueItem.findUnique({
      where: {
        estoqueId_produtoId: {
          estoqueId: id,
          produtoId: produtoId
        }
      }
    });

    if (estoqueItem) {
      const atualizado = await prisma.estoqueItem.update({
        where: { id: estoqueItem.id },
        data: { quantidade: { increment: incremento } }
      });
      return NextResponse.json({ success: true, data: atualizado });
    } else {
      // Se não existe, cria (permitido apenas para ENTRADA, mas para evitar erro vamos permitir)
      const novo = await prisma.estoqueItem.create({
        data: {
          estoqueId: id,
          produtoId: produtoId,
          quantidade: incremento,
          tenantId: tenantId
        }
      });
      return NextResponse.json({ success: true, data: novo });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
