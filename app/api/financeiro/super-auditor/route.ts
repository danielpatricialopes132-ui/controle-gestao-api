import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);

    // Exclusivo para usuários MASTER
    if (userAuth.role !== 'MASTER') {
      return NextResponse.json(
        { success: false, error: 'Acesso negado: Exclusivo para usuários MASTER.' },
        { status: 403 }
      );
    }

    const tenantId = userAuth.tenantId;

    // 1. Buscar Categorias / Plano de Contas da Empresa
    const categorias = await prisma.categoriaFinanceira.findMany({
      where: { tenantId, isAtiva: true },
      select: { id: true, codigo: true, descricao: true, tipo: true },
      orderBy: { codigo: 'asc' },
    });

    // 2. Buscar Obras ativas para contexto
    const obras = await prisma.obra.findMany({
      where: { tenantId },
      select: { id: true, nome: true },
    });

    // 3. Buscar Transações com relações
    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: { tenantId },
      include: {
        categoriaFk: { select: { id: true, descricao: true, codigo: true } },
        obra: { select: { id: true, nome: true } },
        contaBancaria: { select: { id: true, nome: true } },
        funcionario: { select: { id: true, nome: true, cargo: true } },
      },
      orderBy: { dataVencimento: 'desc' },
      take: 200, // Amostra expressiva para auditoria rápida
    });

    // 4. DUPLICIDADES
    const duplicidadesMap = new Map<string, typeof transacoes>();
    for (const t of transacoes) {
      const valorNum = Number(t.valor).toFixed(2);
      const key = `${t.tipo}_${valorNum}`;
      if (!duplicidadesMap.has(key)) {
        duplicidadesMap.set(key, []);
      }
      duplicidadesMap.get(key)!.push(t);
    }

    const gruposDuplicados: any[] = [];
    duplicidadesMap.forEach((lista, key) => {
      if (lista.length > 1) {
        const subgrupos: typeof lista[] = [];
        lista.forEach((item) => {
          const itemDate = new Date(item.dataPagamento || item.dataVencimento || item.createdAt).getTime();
          let added = false;
          for (const g of subgrupos) {
            const firstDate = new Date(g[0].dataPagamento || g[0].dataVencimento || g[0].createdAt).getTime();
            const diffDias = Math.abs(itemDate - firstDate) / (1000 * 60 * 60 * 24);
            if (diffDias <= 3) {
              g.push(item);
              added = true;
              break;
            }
          }
          if (!added) subgrupos.push([item]);
        });

        for (const sg of subgrupos) {
          if (sg.length > 1) {
            gruposDuplicados.push({
              chave: key,
              valor: Number(sg[0].valor),
              tipo: sg[0].tipo,
              motivo: `Mesmo valor (R$ ${Number(sg[0].valor).toFixed(2)}) e intervalo <= 3 dias`,
              transacoes: sg,
            });
          }
        }
      }
    });

    // 5. COMPROVANTES
    const pagosSemComprovante = transacoes.filter((t) => {
      const isPago = t.status === 'PAGO' || t.status === 'CONCILIADO';
      const semAnexo = !t.comprovanteUrl || t.comprovanteUrl.trim() === '';
      return isPago && semAnexo;
    });

    // 6. ENQUADRAMENTO CONTÁBIL & AUDITORIA DE BENEFICIÁRIOS (FOLHA, PRÓ-LABORE, FORNECEDOR, TERCEIROS)
    const suspeitasEnquadramento: Array<{
      transacao: any;
      problemaDetectado: string;
      sugestaoPlanoContaId?: string;
      sugestaoDescricao?: string;
      justificativa: string;
    }> = [];

    for (const t of transacoes) {
      const catAtual = t.categoriaFk?.descricao?.toLowerCase() || '';
      const descLower = t.descricao.toLowerCase();
      const temObra = !!t.obraId;

      let problema = '';
      let sugestaoCat: typeof categorias[0] | undefined;
      let justificativa = '';

      // a) Sem categoria
      if (!t.categoriaId || !t.categoriaFk) {
        problema = 'Sem plano de contas / categoria definida';
        if (descLower.includes('cimento') || descLower.includes('areia') || descLower.includes('tijolo') || descLower.includes('concreto')) {
          sugestaoCat = categorias.find(c => c.descricao.toLowerCase().includes('material') || c.descricao.toLowerCase().includes('insumo'));
          justificativa = 'Identificado insumo de construção na descrição.';
        } else if (descLower.includes('salario') || descLower.includes('diaria') || descLower.includes('folha') || descLower.includes('pro-labore') || descLower.includes('prolabore') || descLower.includes('pró-labore')) {
          sugestaoCat = categorias.find(c => c.descricao.toLowerCase().includes('pro-labore') || c.descricao.toLowerCase().includes('pessoal') || c.descricao.toLowerCase().includes('folha') || c.descricao.toLowerCase().includes('salario'));
          justificativa = 'Pagamento com termos de folha de pagamento, pró-labore ou mão de obra.';
        } else if (descLower.includes('aluguel') || descLower.includes('energia') || descLower.includes('internet') || descLower.includes('agua')) {
          sugestaoCat = categorias.find(c => c.descricao.toLowerCase().includes('administrativ') || c.descricao.toLowerCase().includes('consumo'));
          justificativa = 'Despesa contínua operacional/administrativa.';
        }
      } 
      // b) Categoria genérica
      else if (catAtual.includes('outro') || catAtual.includes('diverso') || catAtual.includes('geral')) {
        problema = `Enquadrado em categoria genérica: "${t.categoriaFk?.descricao}"`;
        justificativa = 'Categorias genéricas prejudicam a precisão da DRE e o centro de custos.';
      } 
      // c) Conflito Custo de Obra vs Administrativo
      else if (temObra && (catAtual.includes('administrativ') || catAtual.includes('escritorio'))) {
        problema = `Transação da obra "${t.obra?.nome}" alocada como Despesa Administrativa`;
        sugestaoCat = categorias.find(c => c.descricao.toLowerCase().includes('custo') || c.descricao.toLowerCase().includes('obra') || c.descricao.toLowerCase().includes('material'));
        justificativa = 'Despesas alocadas a obras devem compor os Custos Diretos da Obra no plano de contas para correta margem bruta.';
      }
      // d) Pagamentos de Folha (Campo ou Escritório), Pró-Labore ou Fornecedores/Terceiros sem recebedor vinculado
      else if (t.tipo === 'DESPESA') {
        const isFolhaOuPessoal = catAtual.includes('folha') || catAtual.includes('salário') || catAtual.includes('salario') || catAtual.includes('pessoal');
        const isProLabore = catAtual.includes('pró-labore') || catAtual.includes('pro-labore') || catAtual.includes('prolabore') || descLower.includes('pro-labore') || descLower.includes('prolabore') || descLower.includes('pró-labore');
        const isFornecedorOuTerceiro = catAtual.includes('fornecedor') || catAtual.includes('terceiro') || catAtual.includes('empreiteiro') || descLower.includes('empreiteiro');

        const temVinculo = !!t.funcionarioId || (t.clienteFornecedor && t.clienteFornecedor.trim() !== '');

        if (!temVinculo) {
          if (isProLabore) {
            problema = 'Pró-Labore sem sócio/administrador vinculado como recebedor';
            justificativa = 'Para conformidade contábil e fiscal, retiradas de pró-labore devem estar vinculadas nominalmente ao sócio beneficiário.';
          } else if (isFolhaOuPessoal) {
            problema = 'Pagamento de Folha/Salário sem colaborador vinculado';
            justificativa = 'A despesa de folha deve estar vinculada ao colaborador do RH para histórico financeiro individual e cálculo de encargos.';
          } else if (isFornecedorOuTerceiro) {
            problema = 'Despesa com Terceiro/Fornecedor sem recebedor nominal';
            justificativa = 'Para rastreabilidade de compras e auditoria fiscal, o fornecedor ou prestador deve estar vinculado.';
          }
        }
      }

      if (problema) {
        suspeitasEnquadramento.push({
          transacao: t,
          problemaDetectado: problema,
          sugestaoPlanoContaId: sugestaoCat?.id,
          sugestaoDescricao: sugestaoCat ? `${sugestaoCat.codigo} - ${sugestaoCat.descricao}` : undefined,
          justificativa: justificativa || 'Recomendada reclassificação contábil para conformidade com a DRE.',
        });
      }
    }

    // 7. CÁLCULO DO SCORE DE SAÚDE CONTÁBIL (0 a 100%)
    const totalTransacoes = transacoes.length || 1;
    const pesoDuplicadas = gruposDuplicados.reduce((acc, g) => acc + (g.transacoes.length - 1), 0) * 15;
    const pesoSemComprovante = pagosSemComprovante.length * 3;
    const pesoEnquadramento = suspeitasEnquadramento.length * 5;
    const penalidades = pesoDuplicadas + pesoSemComprovante + pesoEnquadramento;

    const scoreCalculado = Math.max(10, Math.min(100, Math.round(100 - (penalidades / totalTransacoes) * 15)));

    return NextResponse.json({
      success: true,
      scoreSaudeContabil: scoreCalculado,
      resumo: {
        totalTransacoesAnalisadas: transacoes.length,
        qtdDuplicidades: gruposDuplicados.length,
        qtdPagosSemComprovante: pagosSemComprovante.length,
        qtdSuspeitasEnquadramento: suspeitasEnquadramento.length,
        totalCategoriasPlanoContas: categorias.length,
      },
      duplicidades: gruposDuplicados,
      pagosSemComprovante,
      enquadramentoContabil: suspeitasEnquadramento,
      planoContasDisponivel: categorias,
    });
  } catch (error: any) {
    console.error('Erro no Super Auditor:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// Endpoint POST para reclassificar ou vincular em lote/individualmente com 1 clique pelo MASTER
export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);

    if (userAuth.role !== 'MASTER') {
      return NextResponse.json({ success: false, error: 'Acesso negado: Exclusivo para usuários MASTER.' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;
    const { acao, transacaoId, categoriaId, obraId, funcionarioId, clienteFornecedor } = await request.json();

    if (acao === 'RECLASSIFICAR' && transacaoId) {
      const updateData: any = {};
      if (categoriaId) updateData.categoriaId = categoriaId;
      if (obraId !== undefined) updateData.obraId = obraId;
      if (funcionarioId !== undefined) updateData.funcionarioId = funcionarioId;
      if (clienteFornecedor !== undefined) updateData.clienteFornecedor = clienteFornecedor;

      const transacaoAtualizada = await prisma.transacaoFinanceira.update({
        where: { id: transacaoId, tenantId },
        data: updateData,
      });

      return NextResponse.json({ success: true, data: transacaoAtualizada });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida ou parâmetros ausentes.' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro na ação do Super Auditor:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
