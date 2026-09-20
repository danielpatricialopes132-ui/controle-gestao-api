import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (!userAuth || !userAuth.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    const tenantId = userAuth.tenantId;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('data'); // Opcional, filtra pelo dia
    const obraId = searchParams.get('obraId'); // Opcional, filtra pela obra
    const fornecedorId = searchParams.get('fornecedorId'); // Opcional, filtra pelo empreiteiro/subcontratado

    const where: any = { tenantId };
    
    if (dateStr) {
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      
      where.data = {
        gte: startOfDay.toISOString(),
        lte: endOfDay.toISOString(),
      };
    }
    if (obraId) {
      where.obraId = obraId;
    }
    if (fornecedorId) {
      where.funcionario = {
        OR: [
          { fornecedorId: fornecedorId },
          { fornecedor: { empreiteiroPaiId: fornecedorId } }
        ]
      };
    }

    const presencas = await prisma.registroPresenca.findMany({
      where,
      include: {
        funcionario: {
          include: {
            fornecedor: {
              include: {
                empreiteiroPai: true
              }
            }
          }
        },
        obra: true
      },
      orderBy: { data: 'desc' }
    });

    return NextResponse.json({ success: true, data: presencas });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (!userAuth || !userAuth.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    const tenantId = userAuth.tenantId;
    const body = await request.json();
    
    if (!body.funcionarioId || !body.status || !body.data) {
      return NextResponse.json({ success: false, error: 'Funcionario, Status e Data são obrigatórios' }, { status: 400 });
    }

    const presenca = await prisma.registroPresenca.create({
      data: {
        data: body.data,
        status: body.status,
        observacao: body.observacao,
        funcionarioId: body.funcionarioId,
        obraId: body.obraId,
        tenantId: tenantId,
      },
      include: {
        funcionario: true
      }
    });

    return NextResponse.json({ success: true, data: presenca });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}


