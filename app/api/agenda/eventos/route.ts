import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/fcm";

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const usuarioDb = await prisma.usuario.findUnique({
      where: { firebaseUid: auth.uid },
      select: { id: true, tenantId: true },
    });

    if (!usuarioDb) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo"); // 'TODOS', 'PROFISSIONAL', 'PESSOAL'
    const inicioStr = searchParams.get("inicio");
    const fimStr = searchParams.get("fim");
    const obraId = searchParams.get("obraId");

    const dataInicioFiltro = inicioStr ? new Date(inicioStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dataFimFiltro = fimStr ? new Date(fimStr) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Eventos onde o usuário é o criador OU foi convidado como participante
    const eventos = await prisma.agendaEvento.findMany({
      where: {
        tenantId: usuarioDb.tenantId,
        dataInicio: { gte: dataInicioFiltro },
        dataFim: { lte: dataFimFiltro },
        status: { not: "CANCELADO" },
        ...(obraId ? { obraId } : {}),
        ...(tipo && tipo !== "TODOS" ? { tipo: tipo as any } : {}),
        OR: [
          { criadorId: usuarioDb.id },
          {
            // Se for convidado, só vê se for evento profissional OU se o usuário for o participante específico
            participantes: {
              some: { usuarioId: usuarioDb.id },
            },
          },
        ],
      },
      include: {
        criador: {
          select: { id: true, nome: true, email: true },
        },
        obra: {
          select: { id: true, nome: true },
        },
        cliente: {
          select: { id: true, nome: true },
        },
        participantes: {
          include: {
            usuario: {
              select: { id: true, nome: true, email: true },
            },
          },
        },
        lembretes: true,
      },
      orderBy: { dataInicio: "asc" },
    });

    return NextResponse.json(eventos);
  } catch (error: any) {
    console.error("Erro ao listar eventos da agenda:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const usuarioDb = await prisma.usuario.findUnique({
      where: { firebaseUid: auth.uid },
      select: { id: true, nome: true, tenantId: true },
    });

    if (!usuarioDb) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const {
      titulo,
      descricao,
      tipo = "PROFISSIONAL",
      dataInicio,
      dataFim,
      diaInteiro = false,
      local,
      obraId,
      clienteId,
      conversaChatId,
      participantes = [], // Array de { usuarioId?, emailExterno?, nomeExterno? }
      lembretes = [15], // Minutos antes
    } = body;

    if (!titulo || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: "Título, data de início e data de fim são obrigatórios." },
        { status: 400 }
      );
    }

    const evento = await prisma.agendaEvento.create({
      data: {
        tenantId: usuarioDb.tenantId,
        criadorId: usuarioDb.id,
        tipo,
        titulo,
        descricao,
        local,
        dataInicio: new Date(dataInicio),
        dataFim: new Date(dataFim),
        diaInteiro,
        obraId: obraId || null,
        clienteId: clienteId || null,
        conversaChatId: conversaChatId || null,
        participantes: {
          create: participantes.map((p: any) => ({
            usuarioId: p.usuarioId || null,
            emailExterno: p.emailExterno || null,
            nomeExterno: p.nomeExterno || null,
            statusConvite: p.usuarioId === usuarioDb.id ? "ACEITO" : "PENDENTE",
          })),
        },
        lembretes: {
          create: lembretes.map((minutos: number) => ({
            canal: "PUSH",
            minutosAntes: minutos,
          })),
        },
      },
      include: {
        participantes: {
          include: {
            usuario: { select: { id: true, nome: true, email: true } },
          },
        },
        lembretes: true,
      },
    });

    // Se houver participantes internos convidados, enviar Push Notification de convite
    const convidadosInternos = participantes
      .filter((p: any) => p.usuarioId && p.usuarioId !== usuarioDb.id)
      .map((p: any) => p.usuarioId as string);

    if (convidadosInternos.length > 0) {
      const dataFormatada = new Date(dataInicio).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      sendPushToUsers(
        convidadosInternos,
        "Novo Convite de Reunião",
        `${usuarioDb.nome} convidou você para "${titulo}" em ${dataFormatada}`,
        {
          eventoId: evento.id,
          tipo: "AGENDA_CONVITE",
        }
      ).catch((err) => console.error("Erro ao enviar push de convite:", err));
    }

    // Se o evento foi criado a partir de um chat, envia um card automático na conversa
    if (conversaChatId) {
      await prisma.chatMensagem.create({
        data: {
          conversaId: conversaChatId,
          remetenteId: usuarioDb.id,
          conteudo: `📅 Novo compromisso agendado: **${titulo}**`,
          tipoAnexo: "LINK_ERP",
          dadosContexto: {
            entidade: "COMPROMISSO",
            eventoId: evento.id,
            titulo,
            dataInicio,
            dataFim,
          },
        },
      });
    }

    return NextResponse.json(evento, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar evento na agenda:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
