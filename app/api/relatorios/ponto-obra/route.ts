import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    
    // Obter o tenantId ou validar acesso MASTER (neste caso, pegamos do userAuth)
    const tenantId = userAuth.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const obraId = searchParams.get('obraId');
    const mesStr = searchParams.get('mes');
    const anoStr = searchParams.get('ano');

    if (!obraId) {
      return NextResponse.json({ error: 'obraId é obrigatório' }, { status: 400 });
    }

    const hoje = new Date();
    const mes = mesStr ? parseInt(mesStr, 10) : hoje.getMonth() + 1;
    const ano = anoStr ? parseInt(anoStr, 10) : hoje.getFullYear();

    const startOfMonth = new Date(ano, mes - 1, 1);
    const endOfMonth = new Date(ano, mes, 1);

    // Buscar presenças na obra para o mês atual
    const presencas = await prisma.registroPresenca.findMany({
      where: {
        tenantId: userAuth.tenantId,
        obraId,
        data: {
          gte: startOfMonth,
          lt: endOfMonth,
        }
      },
      include: {
        funcionario: true,
      },
    });

    // Buscar Vales pagos/pendentes para esses funcionários no mesmo mês
    // Para simplificar, buscamos vales de todos e depois filtramos
    const vales = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId: userAuth.tenantId,
        funcionarioId: { not: null },
        tipo: 'DESPESA',
        // Podemos considerar Vales da Categoria "Vale" ou pela descrição.
        // No esquema, vale pode estar na categoria. Vamos puxar todas as despesas por funcionário e filtrar no frontend ou aqui
        dataVencimento: {
          gte: startOfMonth,
          lt: endOfMonth,
        }
      }
    });

    const relatorioMap = new Map();

    presencas.forEach((p) => {
      const funcId = p.funcionario.id;
      if (!relatorioMap.has(funcId)) {
        relatorioMap.set(funcId, {
          funcionario: p.funcionario.nome,
          cargo: p.funcionario.cargo,
          diaria: Number(p.funcionario.salario ?? p.funcionario.valorDiariaMotorista ?? 0), // Assumindo salário base ou diária
          diasTrabalhados: 0,
          valorBruto: 0,
          vales: 0,
          liquidoAReceber: 0,
        });
      }

      const dados = relatorioMap.get(funcId);
      
      // Contabiliza se for TRABALHO ou VIAGEM (depende da regra de negócio)
      if (p.status === 'TRABALHO' || p.status === 'VIAGEM') {
        // Assume percentualPago ou contagem de dia
        const percentual = Number(p.percentualPago ?? 100) / 100;
        dados.diasTrabalhados += percentual;
        dados.valorBruto += (dados.diaria * percentual);
      }
    });

    // Subtrair Vales
    vales.forEach((v) => {
      if (v.funcionarioId && relatorioMap.has(v.funcionarioId)) {
        // Se quisermos deduzir apenas os vales que têm "Vale" no nome, ou na categoria
        const isVale = v.descricao.toLowerCase().includes('vale') || v.categoria?.toLowerCase() === 'vale';
        if (isVale) {
          const dados = relatorioMap.get(v.funcionarioId);
          dados.vales += Number(v.valor);
        }
      }
    });

    // Calcular liquido
    const resultados = Array.from(relatorioMap.values()).map(r => {
      r.liquidoAReceber = r.valorBruto - r.vales;
      return r;
    });

    return NextResponse.json({
      obraId,
      mes,
      ano,
      funcionarios: resultados
    });
  } catch (error) {
    console.error('Erro ao gerar relatório de ponto por obra:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
