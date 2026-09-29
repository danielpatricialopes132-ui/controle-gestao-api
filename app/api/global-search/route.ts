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

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    if (!q || q.length < 2) {
      return NextResponse.json({ resultados: [] });
    }

    const tenantId = usuarioDb.tenantId;

    // Busca paralela otimizada por diversas entidades
    const [obras, clientes, funcionarios, contatos, ordensCompra] = await Promise.all([
      // 1. Obras
      prisma.obra.findMany({
        where: {
          tenantId,
          nome: { contains: q, mode: "insensitive" },
        },
        select: { id: true, nome: true, status: true },
        take: 5,
      }),

      // 2. Clientes
      prisma.cliente.findMany({
        where: {
          tenantId,
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { telefone: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, nome: true, email: true },
        take: 5,
      }),

      // 3. Colaboradores / Funcionários
      prisma.funcionario.findMany({
        where: {
          tenantId,
          nome: { contains: q, mode: "insensitive" },
        },
        select: { id: true, nome: true, cargo: true },
        take: 5,
      }),

      // 4. Agenda Telefônica / Contatos
      prisma.contato.findMany({
        where: {
          tenantId,
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { especialidade: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, nome: true, telefone: true, especialidade: true },
        take: 5,
      }),

      // 5. Ordens de Compra
      prisma.ordemCompra.findMany({
        where: {
          tenantId,
          OR: [
            { numero: { contains: q, mode: "insensitive" } },
            { fornecedor: { nome: { contains: q, mode: "insensitive" } } },
          ],
        },
        select: { id: true, numero: true, status: true, total: true },
        take: 5,
      }),
    ]);

    const resultados: any[] = [];

    // Formata Obras
    obras.forEach((o) => {
      resultados.push({
        id: o.id,
        tipo: "OBRA",
        titulo: o.nome,
        subtitulo: `Obra • Status: ${o.status}`,
        icone: "apartment",
        rota: "/obras",
        dados: o,
      });
    });

    // Formata Clientes
    clientes.forEach((c) => {
      resultados.push({
        id: c.id,
        tipo: "CLIENTE",
        titulo: c.nome,
        subtitulo: `Cliente CRM • ${c.email || "Sem e-mail"}`,
        icone: "handshake",
        rota: "/crm",
        dados: c,
      });
    });

    // Formata Funcionários
    funcionarios.forEach((f) => {
      resultados.push({
        id: f.id,
        tipo: "FUNCIONARIO",
        titulo: f.nome,
        subtitulo: `Colaborador RH • ${f.cargo || "Geral"}`,
        icone: "people",
        rota: "/rh",
        dados: f,
      });
    });

    // Formata Contatos Telefônicos
    contatos.forEach((ct) => {
      resultados.push({
        id: ct.id,
        tipo: "CONTATO",
        titulo: ct.nome,
        subtitulo: `Agenda Telefônica • ${ct.especialidade || ct.telefone || "Contato"}`,
        icone: "contact_phone",
        rota: "/agenda",
        dados: ct,
      });
    });

    // Formata Ordens de Compra
    ordensCompra.forEach((oc) => {
      resultados.push({
        id: oc.id,
        tipo: "ORDEM_COMPRA",
        titulo: `Ordem #${oc.numero}`,
        subtitulo: `Suprimentos • R\$ ${oc.total} • ${oc.status}`,
        icone: "inventory_2",
        rota: "/suprimentos",
        dados: oc,
      });
    });

    return NextResponse.json({ resultados });
  } catch (error: any) {
    console.error("Erro na busca global:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
