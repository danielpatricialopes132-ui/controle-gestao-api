import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;

    const contas = await prisma.contaBancaria.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
    });

    return NextResponse.json(contas);
  } catch (error: any) {
    console.error('Erro ao listar contas bancárias:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    const { nome, banco, agencia, conta, saldoInicial } = body;

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const novaConta = await prisma.contaBancaria.create({
      data: {
        nome,
        banco,
        agencia,
        conta,
        saldoInicial: saldoInicial ? Number(saldoInicial) : 0,
        tenantId
      }
    });

    return NextResponse.json(novaConta, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar conta bancária:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
