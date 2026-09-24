import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId } = await params;

    const terceiros = await prisma.terceiroCliente.findMany({
      where: { obraId, tenantId: userAuth.tenantId },
      include: {
        punchList: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(terceiros);
  } catch (error: any) {
    console.error('Erro ao listar terceiros do cliente:', error);
    return NextResponse.json({ error: 'Erro ao listar empresas terceiras' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: obraId } = await params;
    const body = await request.json();

    const novo = await prisma.terceiroCliente.create({
      data: {
        tenantId: userAuth.tenantId,
        obraId,
        nomeEmpresa: body.nomeEmpresa,
        especialidade: body.especialidade || 'OUTROS',
        responsavel: body.responsavel,
        telefone: body.telefone,
        email: body.email,
        valorContrato: body.valorContrato ? Number(body.valorContrato) : 0,
        status: body.status || 'CONTRATADO',
        dataPrevisaoInicio: body.dataPrevisaoInicio ? new Date(body.dataPrevisaoInicio) : null,
        dataPrevisaoFim: body.dataPrevisaoFim ? new Date(body.dataPrevisaoFim) : null,
        observacoes: body.observacoes,
      }
    });

    return NextResponse.json(novo, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar terceiro do cliente:', error);
    return NextResponse.json({ error: 'Erro ao cadastrar empresa terceira' }, { status: 500 });
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
