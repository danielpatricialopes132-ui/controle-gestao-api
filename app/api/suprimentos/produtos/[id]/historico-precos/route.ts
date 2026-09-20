import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const { id } = await params;

    const produto = await prisma.produto.findFirst({
      where: { id, tenantId },
    });

    if (!produto) {
      return NextResponse.json({ success: false, error: "Produto não encontrado" }, { status: 404 });
    }

    // Busca todas as compras deste produto ordenadas por data desc
    const itensCompra = await prisma.ordemCompraItem.findMany({
      where: {
        produtoId: id,
        tenantId,
      },
      include: {
        ordemCompra: {
          include: {
            fornecedor: true,
            obra: true,
          },
        },
      },
      orderBy: {
        ordemCompra: {
          createdAt: "desc",
        },
      },
    });

    // Busca itens de propostas orçamentárias que mencionem o nome do produto
    const itensProposta = await prisma.propostaItem.findMany({
      where: {
        descricao: { contains: produto.nome, mode: "insensitive" },
        proposta: { tenantId },
      },
      include: {
        proposta: {
          include: {
            obra: true,
            cliente: true,
          },
        },
      },
    });

    // Cálculos estatísticos
    let quantidadeTotalComprada = 0;
    let valorTotalGasto = 0;
    const precos: number[] = [];

    const fornecedoresMap: Record<
      string,
      {
        fornecedorId: string;
        fornecedorNome: string;
        quantidadeTotal: number;
        valorTotalGasto: number;
        precos: number[];
        ultimaCompraData: Date;
        ultimoPreco: number;
      }
    > = {};

    const historico = itensCompra.map((item) => {
      const qtd = Number(item.quantidade);
      const precoUnit = Number(item.precoUnitario);
      const totalItem = qtd * precoUnit;
      const dataCompra = item.ordemCompra.createdAt;
      const fId = item.ordemCompra.fornecedorId;
      const fNome = item.ordemCompra.fornecedor?.nome || "Desconhecido";

      quantidadeTotalComprada += qtd;
      valorTotalGasto += totalItem;
      precos.push(precoUnit);

      if (!fornecedoresMap[fId]) {
        fornecedoresMap[fId] = {
          fornecedorId: fId,
          fornecedorNome: fNome,
          quantidadeTotal: 0,
          valorTotalGasto: 0,
          precos: [],
          ultimaCompraData: dataCompra,
          ultimoPreco: precoUnit,
        };
      }

      fornecedoresMap[fId].quantidadeTotal += qtd;
      fornecedoresMap[fId].valorTotalGasto += totalItem;
      fornecedoresMap[fId].precos.push(precoUnit);

      return {
        id: item.id,
        ordemId: item.ordemCompra.id,
        ordemNumero: item.ordemCompra.numero,
        data: dataCompra,
        fornecedorId: fId,
        fornecedorNome: fNome,
        obraNome: item.ordemCompra.obra?.nome || "Geral",
        quantidade: qtd,
        precoUnitario: precoUnit,
        total: totalItem,
        status: item.ordemCompra.status,
      };
    });

    const precoBase = Number(produto.precoBase || 0);
    const precoMedioPonderado =
      quantidadeTotalComprada > 0 ? valorTotalGasto / quantidadeTotalComprada : precoBase;
    const menorPreco = precos.length ? Math.min(...precos) : precoBase;
    const maiorPreco = precos.length ? Math.max(...precos) : precoBase;
    const ultimoPreco = precos.length ? precos[0] : precoBase;

    const variacaoSobreMedia =
      precoMedioPonderado > 0 ? ((ultimoPreco - precoMedioPonderado) / precoMedioPonderado) * 100 : 0;
    const variacaoSobrePrecoBase =
      precoBase > 0 ? ((ultimoPreco - precoBase) / precoBase) * 100 : 0;

    // Alerta se o último preço estiver mais de 10% acima da média ou do preço base
    const alertaSobrepreco =
      ultimoPreco > precoMedioPonderado * 1.1 || (precoBase > 0 && ultimoPreco > precoBase * 1.1);

    // Formata o comparativo por fornecedor
    const comparativoFornecedores = Object.values(fornecedoresMap).map((f) => ({
      fornecedorId: f.fornecedorId,
      fornecedorNome: f.fornecedorNome,
      quantidadeTotal: f.quantidadeTotal,
      precoMedio: f.quantidadeTotal > 0 ? f.valorTotalGasto / f.quantidadeTotal : 0,
      menorPreco: Math.min(...f.precos),
      maiorPreco: Math.max(...f.precos),
      ultimoPreco: f.ultimoPreco,
      ultimaCompraData: f.ultimaCompraData,
    })).sort((a, b) => a.precoMedio - b.precoMedio); // Do mais barato para o mais caro

    const orcadoProposta = itensProposta.map((ip) => ({
      propostaId: ip.propostaId,
      propostaTitulo: ip.proposta.titulo,
      clienteNome: ip.proposta.cliente?.nome,
      obraNome: ip.proposta.obra?.nome || "Não vinculada",
      descricao: ip.descricao,
      quantidade: Number(ip.quantidade),
      valorUnitario: Number(ip.valorUnitario),
      valorTotal: Number(ip.valorTotal),
    }));

    return NextResponse.json({
      success: true,
      data: {
        produto: {
          id: produto.id,
          nome: produto.nome,
          unidadeMedida: produto.unidadeMedida,
          precoBase,
        },
        metricas: {
          totalCompras: itensCompra.length,
          quantidadeTotalComprada,
          valorTotalGasto,
          precoMedioPonderado,
          menorPreco,
          maiorPreco,
          ultimoPreco,
          variacaoSobreMedia,
          variacaoSobrePrecoBase,
          alertaSobrepreco,
        },
        comparativoFornecedores,
        historico,
        orcadoProposta,
      },
    });
  } catch (error: any) {
    console.error("Erro em GET historico-precos:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
