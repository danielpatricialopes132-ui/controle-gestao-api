import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/fcm";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, segmentData: Params) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id: eventoId } = await segmentData.params;
    const body = await request.json();
    const { status, motivoRecusa } = body; // 'ACEITO', 'RECUSADO', 'TALVEZ'

    if (!["ACEITO", "RECUSADO", "TALVEZ"].includes(status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }

    const usuarioDb = await prisma.usuario.findUnique({
      where: { firebaseUid: auth.uid },
      select: { id: true, nome: true },
    });

    if (!usuarioDb) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const participante = await prisma.agendaParticipante.findUnique({
      where: {
        eventoId_usuarioId: {
          eventoId,
          usuarioId: usuarioDb.id,
        },
      },
      include: {
        evento: {
          include: {
            criador: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!participante) {
      return NextResponse.json({ error: "Você não foi convidado para este evento" }, { status: 403 });
    }

    const atualizado = await prisma.agendaParticipante.update({
      where: { id: participante.id },
      data: {
        statusConvite: status,
        motivoRecusa: motivoRecusa || null,
      },
    });

    // Notifica o criador da reunião sobre a resposta
    if (participante.evento.criadorId !== usuarioDb.id) {
      const verbo = status === "ACEITO" ? "aceitou" : status === "RECUSADO" ? "recusou" : "respondeu talvez ao";
      sendPushToUsers(
        [participante.evento.criadorId],
        "Resposta ao Convite de Reunião",
        `${usuarioDb.nome} ${verbo} convite para "${participante.evento.titulo}"`,
        {
          eventoId,
          tipo: "AGENDA_RESPOSTA",
        }
      ).catch((err) => console.error("Erro ao notificar criador:", err));
    }

    return NextResponse.json(atualizado);
  } catch (error: any) {
    console.error("Erro ao responder convite:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
