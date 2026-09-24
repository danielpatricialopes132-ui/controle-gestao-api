import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const resolvedParams = await params;
    const obraId = resolvedParams.id;
    const tenantId = userAuth.tenantId;

    // Buscar etapas do cronograma da obra
    const etapas = await prisma.etapaCronograma.findMany({
      where: {
        obraId,
        tenantId,
      },
      orderBy: {
        dataInicioEstimada: 'asc'
      }
    });

    // Calcular dados para a Curva S (Evolução Físico-Financeira)
    // Curva S Planejada vs Realizada
    // Simplificaremos agrupando por mês/ano para os pontos do gráfico
    const curvaS: any[] = [];
    
    // Total previsto da obra baseado nas etapas
    const totalPrevisto = etapas.reduce((acc, etapa) => acc + Number(etapa.custoPrevisto), 0);
    const totalRealizadoFisico = etapas.reduce((acc, etapa) => acc + (Number(etapa.custoPrevisto) * (Number(etapa.percentualConclusao) / 100)), 0);

    return NextResponse.json({
      success: true,
      data: {
        etapas,
        resumo: {
          totalPrevisto,
          totalRealizadoFisico,
          percentualGeral: totalPrevisto > 0 ? (totalRealizadoFisico / totalPrevisto) * 100 : 0
        },
        curvaS: curvaS // O frontend pode desenhar com as etapas também
      }
    });

  } catch (error: any) {
    console.error('Erro ao buscar cronograma:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
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
