import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(request);
    
    const bimModels = await prisma.bimModel.findMany({
      where: {
        tenantId: userAuth.tenantId,
        obraId: (await params).id,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: bimModels });
  } catch (error: any) {
    console.error('Erro ao buscar modelos BIM:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const userAuth = await verifyIdToken(request);
    const body = await request.json();

    const { nome, ifcUrl, tamanhoBytes } = body;

    if (!nome || !ifcUrl) {
      return NextResponse.json({ error: 'Campos obrigatórios: nome e ifcUrl' }, { status: 400 });
    }

    const newModel = await prisma.bimModel.create({
      data: {
        tenantId: userAuth.tenantId,
        obraId: (await params).id,
        nome,
        ifcUrl,
        tamanhoBytes
      }
    });

    return NextResponse.json({ success: true, data: newModel }, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar modelo BIM:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
