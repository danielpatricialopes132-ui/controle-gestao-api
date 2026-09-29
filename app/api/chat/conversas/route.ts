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

    // Busca conversas onde o usuário é participante
    const participacoes = await prisma.chatParticipante.findMany({
      where: {
        usuarioId: usuarioDb.id,
        conversa: { tenantId: usuarioDb.tenantId },
      },
      include: {
        conversa: {
          include: {
            participantes: {
              include: {
                usuario: {
                  select: { id: true, nome: true, email: true, role: true },
                },
              },
            },
            mensagens: {
              take: 1,
              orderBy: { criadoEm: "desc" },
              include: {
                remetente: {
                  select: { id: true, nome: true },
                },
              },
            },
            obra: {
              select: { id: true, nome: true },
            },
          },
        },
      },
      orderBy: {
        conversa: {
          atualizadoEm: "desc",
        },
      },
    });

    // Formata o retorno calculando não lidas
    const resultado = await Promise.all(
      participacoes.map(async (p) => {
        const c = p.conversa;
        const ultimaLeitura = p.ultimaLeitura || new Date(0);

        const naoLidas = await prisma.chatMensagem.count({
          where: {
            conversaId: c.id,
            remetenteId: { not: usuarioDb.id },
            criadoEm: { gt: ultimaLeitura },
          },
        });

        // Determina nome de exibição para conversas diretas
        let tituloExibicao = c.titulo;
        let outroParticipante = null;

        if (c.tipo === "DIRETA") {
          const outro = c.participantes.find((part) => part.usuarioId !== usuarioDb.id);
          tituloExibicao = outro?.usuario?.nome || "Conversa Direta";
          outroParticipante = outro?.usuario || null;
        } else if (c.tipo === "OBRA" && c.obra) {
          tituloExibicao = `Obra: ${c.obra.nome}`;
        }

        return {
          id: c.id,
          tipo: c.tipo,
          titulo: tituloExibicao,
          obra: c.obra,
          outroParticipante,
          participantes: c.participantes.map((part) => ({
            id: part.id,
            usuarioId: part.usuarioId,
            funcao: part.funcao,
            nome: part.usuario.nome,
            email: part.usuario.email,
            role: part.usuario.role,
          })),
          ultimaMensagem: c.mensagens[0] || null,
          naoLidas,
          atualizadoEm: c.atualizadoEm,
        };
      })
    );

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("Erro ao listar conversas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { tipo = "DIRETA", destinatarioId, participantesIds = [], titulo, obraId } = body;

    // Se for DIRETA, verificar se já existe conversa entre os dois
    if (tipo === "DIRETA") {
      if (!destinatarioId) {
        return NextResponse.json({ error: "destinatarioId é obrigatório para conversa direta" }, { status: 400 });
      }

      if (destinatarioId === usuarioDb.id) {
        return NextResponse.json({ error: "Não é possível criar conversa direta consigo mesmo" }, { status: 400 });
      }

      const conversaExistente = await prisma.chatConversa.findFirst({
        where: {
          tenantId: usuarioDb.tenantId,
          tipo: "DIRETA",
          AND: [
            { participantes: { some: { usuarioId: usuarioDb.id } } },
            { participantes: { some: { usuarioId: destinatarioId } } },
          ],
        },
        include: {
          participantes: {
            include: {
              usuario: { select: { id: true, nome: true, email: true } },
            },
          },
        },
      });

      if (conversaExistente) {
        return NextResponse.json(conversaExistente);
      }

      // Cria nova conversa direta
      const novaConversa = await prisma.chatConversa.create({
        data: {
          tenantId: usuarioDb.tenantId,
          tipo: "DIRETA",
          participantes: {
            create: [
              { usuarioId: usuarioDb.id, funcao: "ADMIN" },
              { usuarioId: destinatarioId, funcao: "MEMBRO" },
            ],
          },
        },
        include: {
          participantes: {
            include: {
              usuario: { select: { id: true, nome: true, email: true } },
            },
          },
        },
      });

      return NextResponse.json(novaConversa, { status: 201 });
    }

    // Se for GRUPO / OBRA / DEPARTAMENTO
    const idsFinais = Array.from(new Set([usuarioDb.id, ...participantesIds]));

    const novoGrupo = await prisma.chatConversa.create({
      data: {
        tenantId: usuarioDb.tenantId,
        tipo,
        titulo: titulo || (tipo === "OBRA" ? "Canal da Obra" : "Novo Grupo"),
        obraId: obraId || null,
        participantes: {
          create: idsFinais.map((uId) => ({
            usuarioId: uId,
            funcao: uId === usuarioDb.id ? "ADMIN" : "MEMBRO",
          })),
        },
      },
      include: {
        participantes: {
          include: {
            usuario: { select: { id: true, nome: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json(novoGrupo, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar conversa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
