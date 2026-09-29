import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, segmentData: Params) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id: conversaId } = await segmentData.params;

    const usuarioDb = await prisma.usuario.findUnique({
      where: { firebaseUid: auth.uid },
      select: { id: true },
    });

    if (!usuarioDb) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Atualiza ultimaLeitura do participante
    const atualizacao = await prisma.chatParticipante.update({
      where: {
        conversaId_usuarioId: {
          conversaId,
          usuarioId: usuarioDb.id,
        },
      },
      data: {
        ultimaLeitura: new Date(),
      },
    });

    // Atualiza status das mensagens não enviadas por ele para LIDO
    await prisma.chatMensagem.updateMany({
      where: {
        conversaId,
        remetenteId: { not: usuarioDb.id },
        status: { not: "LIDO" },
      },
      data: {
        status: "LIDO",
      },
    });

    return NextResponse.json({ success: true, lidaEm: atualizacao.ultimaLeitura });
  } catch (error: any) {
    console.error("Erro ao marcar mensagens como lidas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
