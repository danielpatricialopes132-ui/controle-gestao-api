import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

// GET: Lista os termos de recebimento de interiores da obra
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

    const termos = await prisma.termoRecebimentoInteriores.findMany({
      where: { obraId, tenantId: userAuth.tenantId },
      orderBy: { dataEmissao: 'desc' },
    });

    return NextResponse.json(termos);
  } catch (error: any) {
    console.error('Erro ao listar termos de recebimento:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// POST: Emite um novo termo de recebimento com coleta da assinatura digital do cliente
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

    const {
      nomeCliente,
      documentoCliente,
      assinaturaDigitalCliente,
      responsavelTecnico,
      ressalvasObservacoes,
    } = body;

    if (!nomeCliente) {
      return NextResponse.json(
        { error: 'Nome do cliente é obrigatório para emissão do termo.' },
        { status: 400 }
      );
    }

    // Busca os itens do Punch List da obra para consolidar o balanço de entrega
    const itensPunchList = await prisma.punchListItem.findMany({
      where: { obraId, tenantId: userAuth.tenantId },
      include: {
        terceiro: true,
      },
      orderBy: { ambiente: 'asc' },
    });

    const totalVistoriados = itensPunchList.length;
    const totalResolvidos = itensPunchList.filter((i) => i.status === 'RESOLVIDO').length;
    const statusPunchList =
      totalResolvidos === totalVistoriados
        ? 'TODOS_RESOLVIDOS'
        : 'COM_RESSALVAS_MENORES';

    // Gera numeração sequencial do termo de recebimento
    const totalTermos = await prisma.termoRecebimentoInteriores.count({
      where: { obraId, tenantId: userAuth.tenantId },
    });
    const anoAtual = new Date().getFullYear();
    const numeroTermo = `REC-${anoAtual}-${String(totalTermos + 1).padStart(3, '0')}`;

    // Snapshot dos ambientes inspecionados
    const detalhesAmbientes = itensPunchList.map((item) => ({
      ambiente: item.ambiente,
      descricao: item.descricao,
      status: item.status,
      empresaResponsavel: item.terceiro?.nomeEmpresa || 'Obra Civil / Geral',
      dataResolucao: item.dataResolucao,
    }));

    const termo = await prisma.termoRecebimentoInteriores.create({
      data: {
        obraId,
        tenantId: userAuth.tenantId,
        numeroTermo,
        nomeCliente,
        documentoCliente: documentoCliente || null,
        assinaturaDigitalCliente: assinaturaDigitalCliente || null,
        dataAssinatura: assinaturaDigitalCliente ? new Date() : null,
        responsavelTecnico: responsavelTecnico || null,
        statusPunchList,
        totalItensVistoriados: totalVistoriados,
        totalItensResolvidos: totalResolvidos,
        detalhesAmbientes,
        ressalvasObservacoes: ressalvasObservacoes || null,
        status: assinaturaDigitalCliente ? 'ASSINADO' : 'RASCUNHO',
      },
    });

    return NextResponse.json(termo, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao emitir termo de recebimento de interiores:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
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
