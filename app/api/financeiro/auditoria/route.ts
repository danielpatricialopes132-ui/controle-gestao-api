import { NextResponse } from 'next/server';
import { verifyIdToken, checkRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Buscar todas as transações do tenant com relações
    const transacoes = await prisma.transacaoFinanceira.findMany({
      where: { tenantId },
      include: {
        categoriaFk: { select: { id: true, descricao: true, codigo: true } },
        obra: { select: { id: true, nome: true } },
        contaBancaria: { select: { id: true, nome: true } },
      },
      orderBy: { dataVencimento: 'desc' },
    });

    // 1. DETECÇÃO DE DUPLICIDADES
    // Agrupar por valor numérico absoluto e comparar datas/descrições
    const duplicidadesMap = new Map<string, typeof transacoes>();

    for (const t of transacoes) {
      const valorNum = Number(t.valor).toFixed(2);
      // Data base para proximidade (usa dataPagamento se houver, senão dataVencimento ou createdAt)
      const dataRef = t.dataPagamento || t.dataVencimento || t.createdAt;
      const dataStr = dataRef ? new Date(dataRef).toISOString().split('T')[0] : 'sem_data';

      // Chave aproximada: valor + tipo
      const key = `${t.tipo}_${valorNum}`;
      if (!duplicidadesMap.has(key)) {
        duplicidadesMap.set(key, []);
      }
      duplicidadesMap.get(key)!.push(t);
    }

    const gruposDuplicados: Array<{
      chave: string;
      valor: number;
      tipo: string;
      motivo: string;
      transacoes: any[];
    }> = [];

    duplicidadesMap.forEach((lista, key) => {
      if (lista.length > 1) {
        // Verificar se têm datas próximas (<= 3 dias de diferença)
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
          if (!added) {
            subgrupos.push([item]);
          }
        });

        for (const sg of subgrupos) {
          if (sg.length > 1) {
            gruposDuplicados.push({
              chave: key,
              valor: Number(sg[0].valor),
              tipo: sg[0].tipo,
              motivo: `Mesmo valor (R$ ${Number(sg[0].valor).toFixed(2)}) e datas com até 3 dias de intervalo`,
              transacoes: sg,
            });
          }
        }
      }
    });

    // 2. DETECÇÃO DE PAGOS SEM COMPROVANTE
    const pagosSemComprovante = transacoes.filter((t) => {
      const isPago = t.status === 'PAGO' || t.status === 'CONCILIADO';
      const semAnexo = !t.comprovanteUrl || t.comprovanteUrl.trim() === '';
      return isPago && semAnexo;
    });

    // 3. ANOMALIAS DE CLASSIFICAÇÃO / SEM OBRA / SEM CATEGORIA
    const semObra = transacoes.filter((t) => !t.obraId && !t.obra);
    const semCategoria = transacoes.filter((t) => !t.categoriaId && !t.categoriaFk);
    const semContaBancaria = transacoes.filter((t) => !t.contaBancariaId && !t.contaBancaria);

    // Resumo consolidado
    const totalImpactoDuplicatas = gruposDuplicados.reduce((acc, g) => {
      // Exclui a primeira como original e soma as repetições
      return acc + (g.transacoes.length - 1) * g.valor;
    }, 0);

    const totalPagosSemComprovante = pagosSemComprovante.reduce((acc, t) => acc + Number(t.valor), 0);

    return NextResponse.json({
      success: true,
      resumo: {
        totalTransacoesAnalisadas: transacoes.length,
        qtdGruposDuplicados: gruposDuplicados.length,
        totalTransacoesDuplicadas: gruposDuplicados.reduce((acc, g) => acc + g.transacoes.length, 0),
        totalImpactoDuplicatas,
        qtdPagosSemComprovante: pagosSemComprovante.length,
        totalPagosSemComprovante,
        qtdSemObra: semObra.length,
        qtdSemCategoria: semCategoria.length,
        qtdSemContaBancaria: semContaBancaria.length,
      },
      duplicidades: gruposDuplicados,
      pagosSemComprovante,
      semObra,
      semCategoria,
      semContaBancaria,
    });
  } catch (error: any) {
    console.error('Erro na auditoria inteligente:', error);
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
