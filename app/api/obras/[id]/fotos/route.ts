import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyIdToken, uploadToStorage } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyIdToken(request);
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const fotos = await prisma.fotoObra.findMany({
      where: {
        obraId: id,
        tenantId: user.tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(fotos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyIdToken(request);
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await request.json();
    const { descricao, base64, mimeType } = body;

    if (!base64) {
      return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 });
    }

    // Caminho de destino no Firebase Storage
    const timestamp = new Date().getTime();
    const extensao = mimeType?.split('/')[1] || 'jpeg';
    const destination = `tenants/${user.tenantId}/obras/${id}/fotos/${timestamp}.${extensao}`;
    
    // Faz o upload para o Storage
    const url = await uploadToStorage(base64, destination, mimeType || 'image/jpeg');

    const foto = await prisma.fotoObra.create({
      data: {
        url,
        descricao,
        obraId: id,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json(foto);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
