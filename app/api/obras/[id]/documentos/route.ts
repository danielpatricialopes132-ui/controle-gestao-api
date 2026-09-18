import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyIdToken, uploadToStorage } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyIdToken(request);
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const documentos = await prisma.documentoObra.findMany({
      where: {
        obraId: id,
        tenantId: user.tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(documentos);
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
    const { nome, tipo, base64, mimeType } = body;

    if (!nome || !tipo || !base64) {
      return NextResponse.json({ error: 'Faltam campos obrigatórios' }, { status: 400 });
    }

    // Calcula o tamanho aproximado do arquivo a partir do base64
    const tamanhoBytes = Math.round((base64.length * 3) / 4);
    
    // Caminho de destino no Firebase Storage
    const timestamp = new Date().getTime();
    const extensao = mimeType?.split('/')[1] || 'pdf';
    const destination = `tenants/${user.tenantId}/obras/${id}/documentos/${timestamp}.${extensao}`;
    
    // Faz o upload para o Storage
    const url = await uploadToStorage(base64, destination, mimeType || 'application/pdf');

    const documento = await prisma.documentoObra.create({
      data: {
        nome,
        tipo,
        url,
        tamanhoBytes,
        obraId: id,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json(documento);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
