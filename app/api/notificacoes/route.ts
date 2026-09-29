import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const tenantId = usuarioDb.tenantId;
    const notificacoes: any[] = [];

    // 1. Convites de Reunião Pendentes para o Usuário
    const convitesPendentes = await prisma.agendaParticipante.findMany({
      where: {
        usuarioId: usuarioDb.id,
        statusConvite: "PENDENTE",
        evento: {
          dataInicio: { gte: new Date() },
          status: { not: "CANCELADO" },
        },
      },
      include: {
        evento: {
          select: { id: true, titulo: true, dataInicio: true, criador: { select: { nome: true } } },
        },
      },
      take: 5,
    });

    convitesPendentes.forEach((cp) => {
      notificacoes.push({
        id: `convite_${cp.id}`,
        tipo: "AGENDA",
        titulo: "Convite de Reunião",
        descricao: `${cp.evento.criador.nome} convidou você para "${cp.evento.titulo}"`,
        data: cp.evento.dataInicio,
        rota: "/agenda",
        dados: { eventoId: cp.evento.id },
      });
    });

    // 2. Mensagens Não Lidas no Chat
    const participacoesChat = await prisma.chatParticipante.findMany({
      where: { usuarioId: usuarioDb.id },
      include: {
        conversa: {
          select: {
            id: true,
            titulo: true,
            tipo: true,
            mensagens: {
              where: {
                remetenteId: { not: usuarioDb.id },
                status: { not: "LIDO" },
              },
              take: 5,
              orderBy: { criadoEm: "desc" },
              include: { remetente: { select: { nome: true } } },
            },
          },
        },
      },
    });

    let totalMsgsNaoLidas = 0;
    participacoesChat.forEach((pc) => {
      const msgs = pc.conversa.mensagens;
      if (msgs.length > 0) {
        totalMsgsNaoLidas += msgs.length;
        notificacoes.push({
          id: `chat_${pc.conversa.id}`,
          tipo: "CHAT",
          titulo: pc.conversa.titulo || "Mensagem de Chat",
          descricao: `${msgs[0].remetente.nome}: ${msgs[0].conteudo || "Enviou um anexo"}`,
          data: msgs[0].criadoEm,
          rota: "/chat",
          dados: { conversaId: pc.conversa.id },
        });
      }
    });

    // 3. Ordens de Compra Pendentes de Aprovação
    const ordensPendentes = await prisma.ordemCompra.findMany({
      where: {
        tenantId,
        status: "PENDENTE",
      },
      select: {
        id: true,
        numero: true,
        valorTotal: true,
        createdAt: true,
        fornecedor: { select: { nome: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    ordensPendentes.forEach((op) => {
      notificacoes.push({
        id: `ordem_${op.id}`,
        tipo: "SUPRIMENTOS",
        titulo: `Ordem de Compra #${op.numero} Pendente`,
        descricao: `R\$ ${op.valorTotal} - ${op.fornecedor?.nome || "Fornecedor"} aguardando autorização`,
        data: op.createdAt,
        rota: "/suprimentos",
        dados: { ordemId: op.id },
      });
    });

    // 4. Medições de Empreiteiro Pendentes de Validação
    const medicoesPendentes = await prisma.medicaoEmpreiteiro.findMany({
      where: {
        tenantId,
        status: "PENDENTE",
      },
      select: {
        id: true,
        numero: true,
        valorLiquidoAPagar: true,
        dataMedicao: true,
        contratoEmpreiteiro: {
          select: {
            fornecedor: { select: { nome: true } },
            obra: { select: { nome: true } },
          },
        },
      },
      take: 5,
      orderBy: { dataMedicao: "desc" },
    });

    medicoesPendentes.forEach((med) => {
      notificacoes.push({
        id: `medicao_${med.id}`,
        tipo: "MEDICAO",
        titulo: `Medição #${med.numero} Pendente`,
        descricao: `R\$ ${med.valorLiquidoAPagar} - ${med.contratoEmpreiteiro.fornecedor?.nome || "Empreiteiro"} (${med.contratoEmpreiteiro.obra?.nome || "Obra"})`,
        data: med.dataMedicao,
        rota: "/suprimentos",
        dados: { medicaoId: med.id },
      });
    });

    return NextResponse.json({
      totalNaoLidas: notificacoes.length,
      notificacoes,
    });
  } catch (error: any) {
    console.error("Erro na central de notificações:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
