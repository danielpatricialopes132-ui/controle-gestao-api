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
    const { searchParams } = new URL(request.url);
    const dataStr = searchParams.get('data') || new Date().toISOString().split('T')[0];

    const dataInicio = new Date(`${dataStr}T00:00:00.000Z`);
    const dataFim = new Date(`${dataStr}T23:59:59.999Z`);

    // 1. Obra com cliente
    const obra = await prisma.obra.findFirst({
      where: { id: obraId, tenantId: userAuth.tenantId },
      include: {
        proposta: {
          include: { cliente: true }
        }
      }
    });

    if (!obra) {
      return NextResponse.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // 2. Presenças do dia com funcionários e fornecedores
    const presencas = await prisma.registroPresenca.findMany({
      where: {
        obraId,
        tenantId: userAuth.tenantId,
        data: { gte: dataInicio, lte: dataFim }
      },
      include: {
        funcionario: {
          include: {
            fornecedor: {
              include: {
                empreiteiroPai: true
              }
            }
          }
        }
      }
    });

    // 3. Fotos registradas no dia
    const fotos = await prisma.fotoObra.findMany({
      where: {
        obraId,
        tenantId: userAuth.tenantId,
        createdAt: { gte: dataInicio, lte: dataFim }
      }
    });

    // 4. Clima predominante do dia
    const houveChuva = presencas.some(p => p.status === 'CHUVA');
    const condicaoClimatica = houveChuva ? 'Chuva / Instável' : 'Tempo Bom / Sol';

    return NextResponse.json({
      obra,
      data: dataStr,
      condicaoClimatica,
      presencas,
      fotos,
      totalEfetivo: presencas.length,
      totalHoras: presencas.reduce((acc, curr) => acc + Number(curr.horasTrabalhadas || 0), 0),
    });
  } catch (error: any) {
    console.error('Erro ao buscar Diário de Obra técnico:', error);
    return NextResponse.json({ error: 'Erro ao gerar Diário de Obra técnico' }, { status: 500 });
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
