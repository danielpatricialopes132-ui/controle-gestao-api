import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadToStorage } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const resolvedParams = await params;
    const { token } = resolvedParams;

    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    const terceiro = await prisma.terceiroCliente.findUnique({
      where: { id: token },
      include: {
        obra: {
          select: { id: true, nome: true, tenantId: true },
        },
      },
    });

    if (!terceiro) {
      return NextResponse.json({ error: 'Empresa terceira não encontrada ou token expirado' }, { status: 404 });
    }

    const body = await request.json();
    const { base64, url: directUrl, mimeType, descricao, ambiente, punchListItemId } = body;

    if (!base64 && !directUrl) {
      return NextResponse.json({ error: 'Nenhuma foto enviada' }, { status: 400 });
    }

    let finalUrl = directUrl;

    if (base64) {
      try {
        const timestamp = new Date().getTime();
        const extensao = mimeType?.split('/')[1] || 'jpeg';
        const destination = `tenants/${terceiro.tenantId}/obras/${terceiro.obraId}/fotos-terceiros/${terceiro.id}_${timestamp}.${extensao}`;
        finalUrl = await uploadToStorage(base64, destination, mimeType || 'image/jpeg');
      } catch (uploadErr) {
        console.warn('Falha no upload para o storage central, usando Data URI como contingência:', uploadErr);
        finalUrl = base64.startsWith('data:') ? base64 : `data:${mimeType || 'image/jpeg'};base64,${base64}`;
      }
    }

    const legenda = `[Montador: ${terceiro.nomeEmpresa}${ambiente ? ` - ${ambiente}` : ''}] ${descricao || 'Registro fotográfico de montagem/serviço'}`;

    // Cria o registro na galeria geral da Obra
    const novaFoto = await prisma.fotoObra.create({
      data: {
        url: finalUrl,
        descricao: legenda,
        obraId: terceiro.obraId,
        tenantId: terceiro.tenantId,
      },
    });

    // Se a foto foi vinculada a uma pendência do Punch List, atualiza o item
    if (punchListItemId) {
      await prisma.punchListItem.updateMany({
        where: {
          id: punchListItemId,
          obraId: terceiro.obraId,
        },
        data: {
          status: 'EM_CORRECAO',
          fotoUrl: finalUrl,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Foto enviada com sucesso para a vistoria da obra!',
      foto: novaFoto,
    });
  } catch (error: any) {
    console.error('Erro no upload de foto pelo portal do terceiro:', error);
    return NextResponse.json({ error: 'Erro ao processar envio de foto' }, { status: 500 });
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
