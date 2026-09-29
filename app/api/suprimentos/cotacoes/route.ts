import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken, registrarLog } from "@/lib/auth";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const cotacoes = await prisma.cotacaoCompra.findMany({
      where: { tenantId },
      include: {
        itens: {
          include: { produto: true },
        },
        respostas: {
          include: {
            fornecedor: { select: { id: true, nome: true, email: true, telefone: true } },
            itensResposta: true,
          },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    return NextResponse.json({ success: true, data: cotacoes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    const { titulo, descricao, obraId, prazoLimite, itens, fornecedoresIds } = body;

    if (!titulo || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { success: false, error: "Título e pelo menos um item são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Cria a Cotação e os Itens Solicitados
    const novaCotacao = await prisma.cotacaoCompra.create({
      data: {
        tenantId,
        titulo,
        descricao,
        obraId: obraId || null,
        prazoLimite: prazoLimite ? new Date(prazoLimite) : null,
        itens: {
          create: itens.map((item: any) => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            observacao: item.observacao || null,
          })),
        },
      },
      include: { itens: true },
    });

    // 2. Se fornecedores foram selecionados, gera os convites com Token Único
    const respostasCriadas = [];
    if (Array.isArray(fornecedoresIds) && fornecedoresIds.length > 0) {
      for (const fId of fornecedoresIds) {
        const token = crypto.randomBytes(24).toString("hex");
        const resp = await prisma.cotacaoFornecedorResposta.create({
          data: {
            cotacaoId: novaCotacao.id,
            fornecedorId: fId,
            tokenAcesso: token,
          },
          include: { fornecedor: true },
        });

        // Inicializa as linhas de resposta para cada item solicitado
        for (const item of novaCotacao.itens) {
          await prisma.cotacaoItemResposta.create({
            data: {
              fornecedorRespostaId: resp.id,
              cotacaoItemId: item.id,
              precoUnitario: 0,
              disponivel: true,
            },
          });
        }

        respostasCriadas.push({
          fornecedorId: resp.fornecedorId,
          fornecedorNome: resp.fornecedor.nome,
          fornecedorTelefone: resp.fornecedor.telefone,
          tokenAcesso: token,
          linkAcesso: `${process.env.NEXT_PUBLIC_APP_URL || "https://controle-gestao-ea7ad.web.app"}/cotacao-fornecedor?token=${token}`,
        });
      }
    }

    await registrarLog(userAuth.dbId, tenantId, "CRIAR_COTACAO_MULTI_FORNECEDORES", "SUPRIMENTOS", {
      cotacaoId: novaCotacao.id,
      titulo: novaCotacao.titulo,
      totalItens: novaCotacao.itens.length,
      totalFornecedoresConvidados: respostasCriadas.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...novaCotacao,
        fornecedoresConvidados: respostasCriadas,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST cotacoes:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
