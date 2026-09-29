import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/fcm";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, segmentData: Params) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id: conversaId } = await segmentData.params;
    const { searchParams } = new URL(request.url);
    const take = parseInt(searchParams.get("take") || "50", 10);
    const cursor = searchParams.get("cursor"); // id da mensagem para paginação

    const usuarioDb = await prisma.usuario.findUnique({
      where: { firebaseUid: auth.uid },
      select: { id: true, tenantId: true },
    });

    if (!usuarioDb) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Valida se o usuário pertence à conversa
    const participante = await prisma.chatParticipante.findUnique({
      where: {
        conversaId_usuarioId: {
          conversaId,
          usuarioId: usuarioDb.id,
        },
      },
    });

    if (!participante) {
      return NextResponse.json({ error: "Acesso negado a esta conversa" }, { status: 403 });
    }

    // Busca mensagens
    const mensagens = await prisma.chatMensagem.findMany({
      where: { conversaId },
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { criadoEm: "desc" },
      include: {
        remetente: {
          select: { id: true, nome: true, email: true, role: true },
        },
      },
    });

    return NextResponse.json(mensagens.reverse());
  } catch (error: any) {
    console.error("Erro ao buscar mensagens:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, segmentData: Params) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id: conversaId } = await segmentData.params;
    const body = await request.json();
    const { conteudo, tipoAnexo, urlAnexo, dadosContexto } = body;

    const usuarioDb = await prisma.usuario.findUnique({
      where: { firebaseUid: auth.uid },
      select: { id: true, nome: true, tenantId: true },
    });

    if (!usuarioDb) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Valida participação
    const participante = await prisma.chatParticipante.findUnique({
      where: {
        conversaId_usuarioId: {
          conversaId,
          usuarioId: usuarioDb.id,
        },
      },
      include: {
        conversa: {
          include: {
            participantes: true,
          },
        },
      },
    });

    if (!participante) {
      return NextResponse.json({ error: "Você não é membro desta conversa" }, { status: 403 });
    }

    // Cria a mensagem e atualiza o timestamp da conversa
    const novaMensagem = await prisma.chatMensagem.create({
      data: {
        conversaId,
        remetenteId: usuarioDb.id,
        conteudo: conteudo || null,
        tipoAnexo: tipoAnexo || null,
        urlAnexo: urlAnexo || null,
        dadosContexto: dadosContexto || null,
        status: "ENVIADO",
      },
      include: {
        remetente: {
          select: { id: true, nome: true, email: true, role: true },
        },
      },
    });

    // Atualiza data da conversa
    await prisma.chatConversa.update({
      where: { id: conversaId },
      data: { atualizadoEm: new Date() },
    });

    // Atualiza a última leitura do próprio remetente
    await prisma.chatParticipante.update({
      where: {
        conversaId_usuarioId: {
          conversaId,
          usuarioId: usuarioDb.id,
        },
      },
      data: { ultimaLeitura: new Date() },
    });

    // Dispara Notificação Push (FCM) para os outros participantes não silenciados
    const destinatariosIds = participante.conversa.participantes
      .filter((p) => p.usuarioId !== usuarioDb.id && !p.silenciado)
      .map((p) => p.usuarioId);

    if (destinatariosIds.length > 0) {
      const tituloNotificacao =
        participante.conversa.tipo === "DIRETA"
          ? usuarioDb.nome
          : `${usuarioDb.nome} em ${participante.conversa.titulo || "Grupo"}`;

      const textoPreview =
        conteudo ||
        (tipoAnexo === "IMAGEM"
          ? "📷 Enviou uma foto"
          : tipoAnexo === "DOCUMENTO"
          ? "📄 Enviou um documento"
          : "Enviou um anexo");

      // Disparo assíncrono para não travar a resposta
      sendPushToUsers(destinatariosIds, tituloNotificacao, textoPreview, {
        conversaId,
        tipo: "CHAT_MENSAGEM",
      }).catch((e) => console.error("Erro background push chat:", e));
    }

    return NextResponse.json(novaMensagem, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao enviar mensagem:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
