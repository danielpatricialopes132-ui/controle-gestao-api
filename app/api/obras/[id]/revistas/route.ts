import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

// GET: Listar revistas da obra
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
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipoPeriodicidade'); // 'SEMANAL' | 'MENSAL'

    const where: any = {
      obraId,
      tenantId: userAuth.tenantId,
    };

    if (tipo) {
      where.tipoPeriodicidade = tipo;
    }

    const revistas = await prisma.revistaObra.findMany({
      where,
      orderBy: { dataInicio: 'desc' },
      include: {
        obra: {
          select: {
            id: true,
            nome: true,
            endereco: true,
            proposta: {
              select: {
                cliente: {
                  select: { nome: true, email: true, telefone: true }
                }
              }
            }
          }
        }
      }
    });

    return NextResponse.json(revistas);
  } catch (error: any) {
    console.error('Erro ao listar revistas da obra:', error);
    return NextResponse.json({ error: 'Erro interno ao listar revistas' }, { status: 500 });
  }
}

// POST: Criar uma nova edição da Revista (Semanal ou Mensal) com agregação automática de dados
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
      tipoPeriodicidade = 'MENSAL', // 'SEMANAL' ou 'MENSAL'
      titulo,
      periodoReferencia,
      dataInicio,
      dataFim,
      capaUrl,
      editorial,
      destaques,
      lookahead,
      fotosSelecionadas,
    } = body;

    const dtInicio = new Date(dataInicio);
    const dtFim = new Date(dataFim);

    // 1. Agregação Clima (dias de sol vs chuva)
    const presencas = await prisma.registroPresenca.findMany({
      where: {
        obraId,
        tenantId: userAuth.tenantId,
        data: { gte: dtInicio, lte: dtFim },
      },
      select: { data: true, status: true }
    });

    const datasSol = new Set<string>();
    const datasChuva = new Set<string>();

    for (const p of presencas) {
      const dStr = p.data.toISOString().split('T')[0];
      if (p.status === 'CHUVA') {
        datasChuva.add(dStr);
      } else if (p.status === 'TRABALHO') {
        datasSol.add(dStr);
      }
    }

    const climaDiasChuva = datasChuva.size;
    const climaDiasSol = datasSol.size;

    // 2. Agregação Avanço Médio das Etapas do Cronograma
    const etapas = await prisma.etapaCronograma.findMany({
      where: { obraId, tenantId: userAuth.tenantId },
    });

    let percentualAvanco = 0;
    if (etapas.length > 0) {
      const soma = etapas.reduce((acc, curr) => acc + Number(curr.percentualConclusao), 0);
      percentualAvanco = Math.round(soma / etapas.length);
    }

    // 3. Se não enviou fotos personalizadas, puxa as fotos mais recentes da obra no período
    let fotosCompiladas = fotosSelecionadas;
    if (!fotosCompiladas || (Array.isArray(fotosCompiladas) && fotosCompiladas.length === 0)) {
      const fotosDoPeriodo = await prisma.fotoObra.findMany({
        where: {
          obraId,
          tenantId: userAuth.tenantId,
          createdAt: { gte: dtInicio, lte: dtFim }
        },
        take: 12,
        orderBy: { createdAt: 'desc' }
      });

      fotosCompiladas = fotosDoPeriodo.map((f, idx) => ({
        url: f.url,
        legenda: f.descricao || `Registro visual ${idx + 1}`,
        ambiente: 'Geral',
        tag: 'Evolução',
      }));
    }

    const novaRevista = await prisma.revistaObra.create({
      data: {
        tenantId: userAuth.tenantId,
        obraId,
        tipoPeriodicidade,
        titulo: titulo || (tipoPeriodicidade === 'SEMANAL' ? `Boletim Semanal - ${periodoReferencia}` : `Revista Mensal - ${periodoReferencia}`),
        periodoReferencia,
        dataInicio: dtInicio,
        dataFim: dtFim,
        capaUrl: capaUrl || (fotosCompiladas && fotosCompiladas[0]?.url) || null,
        editorial: editorial || 'Apresentamos o relatório de evolução com os principais avanços técnicos e marcos do período.',
        destaques: destaques || 'Frentes de trabalho ativas com avanço conforme o cronograma executivo.',
        lookahead: lookahead || 'Continuidade das etapas planejadas para o próximo ciclo.',
        climaDiasSol,
        climaDiasChuva,
        percentualAvanco,
        fotosSelecionadas: fotosCompiladas,
        status: 'PUBLICADA',
      },
    });

    return NextResponse.json(novaRevista, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar revista da obra:', error);
    return NextResponse.json({ error: 'Erro ao gerar revista da obra' }, { status: 500 });
  }
}
