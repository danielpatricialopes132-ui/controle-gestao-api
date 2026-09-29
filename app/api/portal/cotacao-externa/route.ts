import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ success: false, error: "Token não fornecido." }, { status: 400 });
    }

    const respostaFornecedor = await prisma.cotacaoFornecedorResposta.findUnique({
      where: { tokenAcesso: token },
      include: {
        fornecedor: { select: { id: true, nome: true, cnpj: true } },
        cotacao: {
          include: {
            tenant: { select: { nome: true, logoUrl: true } },
            itens: {
              include: { produto: true },
            },
          },
        },
        itensResposta: true,
      },
    });

    if (!respostaFornecedor) {
      return NextResponse.json({ success: false, error: "Link de cotação inválido ou expirado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: respostaFornecedor,
    });
  } catch (error: any) {
    console.error("Erro em GET portal/cotacao-externa:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, itensResposta, prazoEntregaDias, condicaoPagamento, observacoes } = body;

    if (!token || !Array.isArray(itensResposta)) {
      return NextResponse.json(
        { success: false, error: "Parâmetros obrigatórios ausentes." },
        { status: 400 }
      );
    }

    const respostaFornecedor = await prisma.cotacaoFornecedorResposta.findUnique({
      where: { tokenAcesso: token },
    });

    if (!respostaFornecedor) {
      return NextResponse.json({ success: false, error: "Cotação não encontrada." }, { status: 404 });
    }

    // Atualiza os preços e marcas enviados pelo fornecedor
    for (const item of itensResposta) {
      await prisma.cotacaoItemResposta.updateMany({
        where: {
          fornecedorRespostaId: respostaFornecedor.id,
          cotacaoItemId: item.cotacaoItemId,
        },
        data: {
          precoUnitario: item.precoUnitario,
          disponivel: item.disponivel ?? true,
          marca: item.marca || null,
          observacao: item.observacao || null,
        },
      });
    }

    // Marca a cotação do fornecedor como respondida
    const atualizado = await prisma.cotacaoFornecedorResposta.update({
      where: { id: respostaFornecedor.id },
      data: {
        respondido: true,
        dataResposta: new Date(),
        prazoEntregaDias: prazoEntregaDias ? parseInt(prazoEntregaDias) : null,
        condicaoPagamento: condicaoPagamento || null,
        observacoes: observacoes || null,
      },
    });

    return NextResponse.json({
      success: true,
      mensagem: "Preços da cotação enviados com sucesso! A construtora foi notificada.",
      data: atualizado,
    });
  } catch (error: any) {
    console.error("Erro em POST portal/cotacao-externa:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
