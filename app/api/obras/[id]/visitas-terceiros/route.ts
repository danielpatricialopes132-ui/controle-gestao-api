import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

// GET: Retorna as visitas de terceiros do cliente para uma obra (com filtro opcional de dataInicio e dataFim)
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

    const inicioStr = searchParams.get('inicio');
    const fimStr = searchParams.get('fim');

    const dataFiltro: any = {};
    if (inicioStr && fimStr) {
      dataFiltro.gte = new Date(inicioStr);
      dataFiltro.lte = new Date(fimStr);
    } else {
      // Padrão: semana atual (segunda a domingo)
      const hoje = new Date();
      const diaSemana = hoje.getDay(); // 0 = Domingo, 1 = Segunda...
      const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
      
      const segunda = new Date(hoje);
      segunda.setDate(hoje.getDate() + diffSegunda);
      segunda.setHours(0, 0, 0, 0);

      const domingo = new Date(segunda);
      domingo.setDate(segunda.getDate() + 6);
      domingo.setHours(23, 59, 59, 999);

      dataFiltro.gte = segunda;
      dataFiltro.lte = domingo;
    }

    // Busca as empresas parceiras com suas visitas no período
    const terceiros = await prisma.terceiroCliente.findMany({
      where: { obraId, tenantId: userAuth.tenantId },
      include: {
        visitas: {
          where: {
            dataVisita: dataFiltro,
          },
          orderBy: { dataVisita: 'asc' },
        },
      },
      orderBy: { nomeEmpresa: 'asc' },
    });

    // Monta o mapa semanal S, T, Q, Q, S, S, D para cada parceiro
    const mapaSemanal = terceiros.map((t) => {
      // Ordenado de Segunda a Domingo: [Seg, Ter, Qua, Qui, Sex, Sáb, Dom]
      const dias = {
        seg: t.visitas.filter((v) => new Date(v.dataVisita).getDay() === 1),
        ter: t.visitas.filter((v) => new Date(v.dataVisita).getDay() === 2),
        qua: t.visitas.filter((v) => new Date(v.dataVisita).getDay() === 3),
        qui: t.visitas.filter((v) => new Date(v.dataVisita).getDay() === 4),
        sex: t.visitas.filter((v) => new Date(v.dataVisita).getDay() === 5),
        sab: t.visitas.filter((v) => new Date(v.dataVisita).getDay() === 6),
        dom: t.visitas.filter((v) => new Date(v.dataVisita).getDay() === 0),
      };

      return {
        terceiroId: t.id,
        nomeEmpresa: t.nomeEmpresa,
        especialidade: t.especialidade,
        statusCiclo: t.status,
        responsavel: t.responsavel,
        telefone: t.telefone,
        dias,
        totalVisitasNaSemana: t.visitas.length,
      };
    });

    return NextResponse.json({
      periodo: {
        inicio: dataFiltro.gte,
        fim: dataFiltro.lte,
      },
      terceiros,
      mapaSemanal,
    });
  } catch (error: any) {
    console.error('Erro ao buscar visitas de terceiros:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}

// POST: Registra uma visita de parceiro do cliente na obra
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

    const { terceiroClienteId, dataVisita, motivo, observacoes, responsavel } = body;

    if (!terceiroClienteId || !dataVisita) {
      return NextResponse.json(
        { error: 'Empresa parceira e data da visita são obrigatórios.' },
        { status: 400 }
      );
    }

    const visita = await prisma.visitaTerceiroCliente.create({
      data: {
        obraId,
        tenantId: userAuth.tenantId,
        terceiroClienteId,
        dataVisita: new Date(dataVisita),
        motivo: motivo || null,
        observacoes: observacoes || null,
        responsavel: responsavel || null,
      },
      include: {
        terceiro: true,
      },
    });

    return NextResponse.json(visita, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar visita de terceiro:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
