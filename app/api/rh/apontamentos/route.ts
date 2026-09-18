import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const obraId = searchParams.get('obraId');
    const data = searchParams.get('data'); // YYYY-MM-DD

    if (!tenantId || !obraId || !data) {
      return NextResponse.json({ error: 'tenantId, obraId e data são obrigatórios' }, { status: 400 });
    }

    const dataStart = new Date(data);
    dataStart.setUTCHours(0, 0, 0, 0);
    const dataEnd = new Date(data);
    dataEnd.setUTCHours(23, 59, 59, 999);

    const apontamentos = await prisma.registroPresenca.findMany({
      where: {
        tenantId,
        obraId,
        data: {
          gte: dataStart,
          lte: dataEnd,
        },
      },
      include: {
        funcionario: true,
      },
    });

    return NextResponse.json(apontamentos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { tenantId, obraId, data: dataRef, apontamentos } = data;
    // apontamentos: [{ funcionarioId, status, horasTrabalhadas, percentualPago, observacao }]

    if (!tenantId || !obraId || !dataRef || !apontamentos || !Array.isArray(apontamentos)) {
      return NextResponse.json({ error: 'Dados inválidos para lote' }, { status: 400 });
    }

    const dataIso = new Date(dataRef);

    // Upsert para cada apontamento (se o usuário alterar e reenviar do mesmo dia)
    const upserts = apontamentos.map((ap: any) => {
      const gte = new Date(dataRef);
      gte.setUTCHours(0,0,0,0);
      const lte = new Date(dataRef);
      lte.setUTCHours(23,59,59,999);

      return prisma.registroPresenca.findFirst({
        where: {
          tenantId,
          obraId,
          funcionarioId: ap.funcionarioId,
          data: { gte, lte }
        }
      }).then(existing => {
        if (existing) {
          return prisma.registroPresenca.update({
            where: { id: existing.id },
            data: {
              status: ap.status,
              horasTrabalhadas: ap.horasTrabalhadas != null ? parseFloat(ap.horasTrabalhadas) : null,
              percentualPago: ap.percentualPago != null ? parseFloat(ap.percentualPago) : null,
              observacao: ap.observacao,
            }
          });
        } else {
          return prisma.registroPresenca.create({
            data: {
              tenantId,
              obraId,
              funcionarioId: ap.funcionarioId,
              data: dataIso,
              status: ap.status,
              horasTrabalhadas: ap.horasTrabalhadas != null ? parseFloat(ap.horasTrabalhadas) : null,
              percentualPago: ap.percentualPago != null ? parseFloat(ap.percentualPago) : null,
              observacao: ap.observacao,
              statusAprovacao: 'PENDENTE'
            }
          });
        }
      });
    });

    const results = await Promise.all(upserts);

    return NextResponse.json({ success: true, count: results.length }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
