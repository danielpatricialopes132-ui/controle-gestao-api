import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    const { token } = params;
    
    // Decodifica o token (base64 simple string for POC)
    // token format expected: base64(tenantId)
    let tenantId;
    try {
      tenantId = Buffer.from(token, 'base64').toString('utf-8');
    } catch (e) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId,
        OR: [
          { status: 'A_CONFIRMAR' },
          { observacao: { contains: 'A CONFIRMAR', mode: 'insensitive' } },
          { statusAprovacao: 'PENDENTE' },
        ],
      },
      include: {
        obra: true,
        contaBancaria: true,
      },
      orderBy: {
        dataVencimento: 'desc'
      }
    });

    return NextResponse.json({
      empresa: tenant.nome,
      transacoes: transacoes.map(t => ({
        id: t.id,
        descricao: t.descricao,
        valor: t.valor,
        data: t.dataVencimento || t.dataPagamento,
        tipo: t.tipo,
        obra: t.obra?.nome || 'Geral',
        contaBancaria: t.contaBancaria?.nome,
        observacao: t.observacao,
      }))
    });

  } catch (error) {
    console.error('Erro GET portal auditoria:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const { token } = params;
    
    let tenantId;
    try {
      tenantId = Buffer.from(token, 'base64').toString('utf-8');
    } catch (e) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { id, justificativa } = body;

    if (!id || !justificativa) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Verifica se a transação é deste tenant
    const transacao = await prisma.transacaoFinanceira.findUnique({
      where: { id }
    });

    if (!transacao || transacao.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 });
    }

    // Remove marcas de pendência
    let novaObs = (transacao.observacao || '')
      .replace(/\[A CONFIRMAR PELA DIRETORIA\]/gi, '')
      .replace(/A CONFIRMAR/gi, '')
      .trim();
      
    novaObs = `${novaObs} [Resp. Diretoria: ${justificativa}]`.trim();

    await prisma.transacaoFinanceira.update({
      where: { id },
      data: {
        observacao: novaObs,
        statusAprovacao: 'APROVADO', // Mark as approved so it doesn't show up again
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro POST portal auditoria:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
