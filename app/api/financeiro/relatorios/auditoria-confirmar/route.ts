import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantOverride = request.headers.get('x-tenant-override');
    const tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;

    const dataInicioParam = searchParams.get('dataInicio');
    const dataFimParam = searchParams.get('dataFim');
    const busca = searchParams.get('busca') || '';

    let whereClause: any = {
      tenantId,
      OR: [
        { status: 'A_CONFIRMAR' },
        { observacao: { contains: 'A CONFIRMAR', mode: 'insensitive' } },
        { statusAprovacao: 'PENDENTE' },
      ],
    };

    if (dataInicioParam && dataFimParam) {
      whereClause.dataVencimento = {
        gte: new Date(dataInicioParam),
        lte: new Date(dataFimParam),
      };
    }

    if (busca.trim()) {
      whereClause.AND = [
        {
          OR: [
            { descricao: { contains: busca, mode: 'insensitive' } },
            { observacao: { contains: busca, mode: 'insensitive' } },
            { clienteFornecedor: { contains: busca, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: whereClause,
      include: {
        categoriaFk: true,
        contaBancaria: true,
        obra: true,
        funcionario: true,
      },
      orderBy: [
        { dataVencimento: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const totalValor = transacoes.reduce((acc, t) => acc + Number(t.valor || 0), 0);
    const totalReceitas = transacoes.filter(t => t.tipo === 'RECEITA').reduce((acc, t) => acc + Number(t.valor || 0), 0);
    const totalDespesas = transacoes.filter(t => t.tipo === 'DESPESA').reduce((acc, t) => acc + Number(t.valor || 0), 0);

    return NextResponse.json({
      resumo: {
        totalItens: transacoes.length,
        totalValor,
        totalReceitas,
        totalDespesas,
      },
      transacoes: transacoes.map(t => ({
        id: t.id,
        descricao: t.descricao,
        tipo: t.tipo,
        valor: Number(t.valor),
        dataVencimento: t.dataVencimento?.toISOString(),
        dataPagamento: t.dataPagamento?.toISOString(),
        status: t.status,
        statusAprovacao: t.statusAprovacao,
        observacao: t.observacao,
        categoria: t.categoriaFk?.nome || t.categoria || 'Sem categoria',
        contaBancaria: t.contaBancaria?.nome || 'Não informada',
        contaBancariaId: t.contaBancariaId,
        obra: t.obra?.nome || 'Geral / Administrativo',
        obraId: t.obraId,
        beneficiario: t.clienteFornecedor || t.funcionario?.nome || '-',
        isConciliada: t.isConciliada,
      })),
    });
  } catch (error: any) {
    console.error('Erro ao buscar auditoria a confirmar:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// Endpoint para aprovar/confirmar a transação
export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { transacaoId, acao, observacao, categoriaId, obraId } = await request.json();

    if (!transacaoId) {
      return NextResponse.json({ error: 'transacaoId é obrigatório' }, { status: 400 });
    }

    const tenantOverride = request.headers.get('x-tenant-override');
    const tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;

    const existing = await prisma.transacaoFinanceira.findFirst({
      where: { id: transacaoId, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 });
    }

    let updateData: any = {};

    if (acao === 'CONFIRMAR') {
      // Confirma e remove marcas de pendência
      let novaObs = (existing.observacao || '')
        .replace(/\[A CONFIRMAR PELA DIRETORIA\]/gi, '')
        .replace(/A CONFIRMAR/gi, '')
        .trim();

      if (observacao) {
        novaObs = `${novaObs} [Confirmado por Auditoria: ${observacao}]`.trim();
      }

      updateData = {
        status: existing.status === 'A_CONFIRMAR' ? 'PAGO' : existing.status,
        statusAprovacao: 'APROVADO',
        observacao: novaObs || null,
        dataPagamento: existing.dataPagamento || existing.dataVencimento || new Date(),
      };
    } else if (acao === 'REJEITAR') {
      updateData = {
        statusAprovacao: 'REJEITADO',
        observacao: `${existing.observacao || ''} [Rejeitado em Auditoria: ${observacao || 'Motivo não informado'}]`.trim(),
      };
    }

    if (categoriaId) updateData.categoriaId = categoriaId;
    if (obraId) updateData.obraId = obraId;

    const updated = await prisma.transacaoFinanceira.update({
      where: { id: transacaoId },
      data: updateData,
    });

    return NextResponse.json({ success: true, transacao: updated });
  } catch (error: any) {
    console.error('Erro ao confirmar transação:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
