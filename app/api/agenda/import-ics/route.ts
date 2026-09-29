import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ical from "node-ical";

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
    const { icsString, base64 } = body;

    let conteudoIcs = icsString;
    if (!conteudoIcs && base64) {
      conteudoIcs = Buffer.from(base64, "base64").toString("utf-8");
    }

    if (!conteudoIcs) {
      return NextResponse.json({ error: "Conteúdo ICS não informado." }, { status: 400 });
    }

    const parsed = await ical.async.parseICS(conteudoIcs);
    const eventosImportados: any[] = [];

    for (const k in parsed) {
      if (!Object.prototype.hasOwnProperty.call(parsed, k)) continue;
      const ev = parsed[k];

      if (ev.type === "VEVENT") {
        const uid = ev.uid || `import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const titulo = ev.summary || "Compromisso Importado";
        const descricao = typeof ev.description === "string" ? ev.description : null;
        const local = typeof ev.location === "string" ? ev.location : null;
        const dataInicio = ev.start ? new Date(ev.start) : new Date();
        const dataFim = ev.end ? new Date(ev.end) : new Date(dataInicio.getTime() + 60 * 60 * 1000);

        // Upsert do evento pelo uidIcal para não duplicar se importar mais de uma vez
        const salvo = await prisma.agendaEvento.upsert({
          where: { uidIcal: uid },
          update: {
            titulo,
            descricao,
            local,
            dataInicio,
            dataFim,
          },
          create: {
            tenantId: usuarioDb.tenantId,
            criadorId: usuarioDb.id,
            tipo: "PROFISSIONAL",
            titulo,
            descricao,
            local,
            dataInicio,
            dataFim,
            uidIcal: uid,
            participantes: {
              create: [
                {
                  usuarioId: usuarioDb.id,
                  statusConvite: "ACEITO",
                },
              ],
            },
            lembretes: {
              create: [{ canal: "PUSH", minutosAntes: 15 }],
            },
          },
        });

        eventosImportados.push(salvo);
      }
    }

    return NextResponse.json({
      success: true,
      totalImportados: eventosImportados.length,
      eventos: eventosImportados,
    });
  } catch (error: any) {
    console.error("Erro ao importar ICS:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
