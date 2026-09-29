import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken, registrarLog } from "@/lib/auth";
import { validarAlcadaUsuario } from "@/lib/workflowAprovacao";

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    const { tipoEntidade, entidadeId, decisao, justificativa } = body;
    // decisao: 'APROVADO' | 'REJEITADO'

    if (!tipoEntidade || !entidadeId || !decisao) {
      return NextResponse.json(
        { success: false, error: "Parâmetros obrigatórios: tipoEntidade, entidadeId, decisao." },
        { status: 400 }
      );
    }

    if (!["APROVADO", "REJEITADO"].includes(decisao)) {
      return NextResponse.json(
        { success: false, error: "A decisão deve ser APROVADO ou REJEITADO." },
        { status: 400 }
      );
    }

    if (tipoEntidade === "ORDEM_COMPRA") {
      const oc = await prisma.ordemCompra.findUnique({
        where: { id: entidadeId, tenantId },
        include: { fornecedor: true, obra: true },
      });

      if (!oc) {
        return NextResponse.json({ success: false, error: "Ordem de compra não encontrada." }, { status: 404 });
      }

      if (oc.status !== "PENDENTE") {
        return NextResponse.json(
          { success: false, error: `Esta ordem de compra já está com status ${oc.status}.` },
          { status: 400 }
        );
      }

      const valor = Number(oc.valorTotal || 0);
      const validacao = await validarAlcadaUsuario({
        tenantId,
        userRole: userAuth.role,
        tipoEntidade: "ORDEM_COMPRA",
        valor,
      });

      if (!validacao.podeAprovar) {
        return NextResponse.json(
          {
            success: false,
            error: `Alçada insuficiente: ${validacao.motivo}`,
            exigeRole: validacao.aprovadorNecessarioRole,
          },
          { status: 403 }
        );
      }

      let transacaoId = oc.transacaoId;

      if (decisao === "APROVADO") {
        // Gera a transação financeira caso ainda não exista
        if (!transacaoId) {
          const transacao = await prisma.transacaoFinanceira.create({
            data: {
              tipo: "DESPESA",
              valor: oc.valorTotal,
              descricao: `Compra de Materiais (OC #${oc.numero}) - ${oc.fornecedor.nome}`,
              status: "PENDENTE",
              dataVencimento: new Date(),
              tenantId,
              obraId: oc.obraId || "",
              clienteFornecedor: oc.fornecedor.nome,
            },
          });
          transacaoId = transacao.id;
        }

        await prisma.ordemCompra.update({
          where: { id: entidadeId },
          data: {
            status: "APROVADA",
            transacaoId,
          },
        });
      } else {
        await prisma.ordemCompra.update({
          where: { id: entidadeId },
          data: { status: "REJEITADA" },
        });
      }

      // Registra a aprovação na governança
      const registro = await prisma.aprovacaoRegistro.create({
        data: {
          tenantId,
          tipoEntidade: "ORDEM_COMPRA",
          entidadeId: oc.id,
          valorEntidade: oc.valorTotal,
          status: decisao,
          aprovadorId: userAuth.dbId,
          justificativa: justificativa || null,
          dataDecisao: new Date(),
        },
      });

      await registrarLog(userAuth.dbId, tenantId, `DECISAO_${decisao}_OC`, "GOVERNANCA", {
        ordemId: oc.id,
        numero: oc.numero,
        decisao,
        justificativa,
        valorTotal: oc.valorTotal,
        registroId: registro.id,
      });

      return NextResponse.json({
        success: true,
        mensagem: `Ordem de Compra #${oc.numero} ${decisao.toLowerCase()} com sucesso!`,
        data: registro,
      });
    }

    if (tipoEntidade === "MEDICAO_EMPREITEIRO") {
      const med = await prisma.medicaoEmpreiteiro.findUnique({
        where: { id: entidadeId, tenantId },
        include: {
          contratoEmpreiteiro: {
            include: { fornecedor: true, obra: true },
          },
        },
      });

      if (!med) {
        return NextResponse.json({ success: false, error: "Medição não encontrada." }, { status: 404 });
      }

      if (med.status !== "PENDENTE") {
        return NextResponse.json(
          { success: false, error: `Esta medição já está com status ${med.status}.` },
          { status: 400 }
        );
      }

      const valorLiquido = Number(med.valorLiquidoAPagar || 0);
      const validacao = await validarAlcadaUsuario({
        tenantId,
        userRole: userAuth.role,
        tipoEntidade: "MEDICAO_EMPREITEIRO",
        valor: valorLiquido,
      });

      if (!validacao.podeAprovar) {
        return NextResponse.json(
          {
            success: false,
            error: `Alçada insuficiente: ${validacao.motivo}`,
            exigeRole: validacao.aprovadorNecessarioRole,
          },
          { status: 403 }
        );
      }

      if (decisao === "APROVADO") {
        // Cria transação financeira no Contas a Pagar se ainda não houver
        const transacao = await prisma.transacaoFinanceira.create({
          data: {
            tipo: "DESPESA",
            descricao: `Medição #${med.numero} - ${med.contratoEmpreiteiro.descricao} (${med.contratoEmpreiteiro.fornecedor.nome})`,
            valor: valorLiquido,
            status: "PENDENTE",
            dataVencimento: new Date(),
            obraId: med.contratoEmpreiteiro.obraId,
            clienteFornecedor: med.contratoEmpreiteiro.fornecedor.nome,
            tenantId,
          },
        });

        await prisma.medicaoEmpreiteiro.update({
          where: { id: entidadeId },
          data: {
            status: "APROVADA",
            transacao: { connect: { id: transacao.id } },
          },
        });
      } else {
        await prisma.medicaoEmpreiteiro.update({
          where: { id: entidadeId },
          data: { status: "GLOSADA" },
        });
      }

      const registro = await prisma.aprovacaoRegistro.create({
        data: {
          tenantId,
          tipoEntidade: "MEDICAO_EMPREITEIRO",
          entidadeId: med.id,
          valorEntidade: med.valorLiquidoAPagar,
          status: decisao,
          aprovadorId: userAuth.dbId,
          justificativa: justificativa || null,
          dataDecisao: new Date(),
        },
      });

      await registrarLog(userAuth.dbId, tenantId, `DECISAO_${decisao}_MEDICAO`, "GOVERNANCA", {
        medicaoId: med.id,
        numero: med.numero,
        decisao,
        justificativa,
        valorLiquido: med.valorLiquidoAPagar,
        registroId: registro.id,
      });

      return NextResponse.json({
        success: true,
        mensagem: `Medição #${med.numero} ${decisao.toLowerCase()} com sucesso!`,
        data: registro,
      });
    }

    return NextResponse.json({ success: false, error: "Tipo de entidade não suportado." }, { status: 400 });
  } catch (error: any) {
    console.error("Erro em POST aprovacoes/decidir:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
