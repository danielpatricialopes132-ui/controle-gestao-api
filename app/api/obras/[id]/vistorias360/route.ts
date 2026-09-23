import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(request);
    
    const vistorias = await prisma.vistoria360.findMany({
      where: {
        tenantId: userAuth.tenantId,
        obraId: params.id,
      },
      orderBy: { dataVistoria: 'desc' }
    });

    return NextResponse.json({ success: true, data: vistorias });
  } catch (error: any) {
    console.error('Erro ao buscar vistorias 360:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(request);
    const body = await request.json();

    const { ambiente, fotoUrl, observacoes, dataVistoria } = body;

    if (!ambiente || !fotoUrl) {
      return NextResponse.json({ error: 'Campos obrigatórios: ambiente e fotoUrl' }, { status: 400 });
    }

    const novaVistoria = await prisma.vistoria360.create({
      data: {
        tenantId: userAuth.tenantId,
        obraId: params.id,
        ambiente,
        fotoUrl,
        observacoes,
        dataVistoria: dataVistoria ? new Date(dataVistoria) : new Date()
      }
    });

    return NextResponse.json({ success: true, data: novaVistoria }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar vistoria 360:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
