import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '../../../../lib/auth';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    
    // Obter o tenantId ou validar acesso MASTER (neste caso, pegamos do userAuth)
    const tenantId = userAuth.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mesStr = searchParams.get('mes');
    const anoStr = searchParams.get('ano');

    const hoje = new Date();
    const mes = mesStr ? parseInt(mesStr, 10) : hoje.getMonth() + 1;
    const ano = anoStr ? parseInt(anoStr, 10) : hoje.getFullYear();

    const startOfMonth = new Date(ano, mes - 1, 1);
    const endOfMonth = new Date(ano, mes, 1);

    // Buscar todos os funcionários
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        tenantId: userAuth.tenantId,
      }
    });

    // Buscar todas as presenças do mês
    const presencas = await prisma.registroPresenca.findMany({
      where: {
        tenantId: userAuth.tenantId,
        data: {
          gte: startOfMonth,
          lt: endOfMonth,
        }
      }
    });

    // Buscar todos os Vales do mês
    const vales = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId: userAuth.tenantId,
        funcionarioId: { not: null },
        tipo: 'DESPESA',
        dataVencimento: {
          gte: startOfMonth,
          lt: endOfMonth,
        }
      }
    });

    const folha = funcionarios.map(func => {
      // Filtrar presenças do func
      const presencasFunc = presencas.filter(p => p.funcionarioId === func.id);
      
      let diasTrabalhados = 0;
      let valorBruto = 0;

      const diaria = Number(func.salario ?? func.valorDiariaMotorista ?? 0);

      presencasFunc.forEach(p => {
        if (p.status === 'TRABALHO' || p.status === 'VIAGEM') {
          const percentual = Number(p.percentualPago ?? 100) / 100;
          diasTrabalhados += percentual;
          valorBruto += (diaria * percentual);
        }
      });

      // Filtrar vales do func
      const valesFunc = vales.filter(v => v.funcionarioId === func.id && (v.descricao.toLowerCase().includes('vale') || v.categoria?.toLowerCase() === 'vale'));
      
      const totalVales = valesFunc.reduce((sum, v) => sum + Number(v.valor), 0);
      const liquidoAReceber = valorBruto - totalVales;

      return {
        id: func.id,
        nome: func.nome,
        cargo: func.cargo,
        diariaBase: diaria,
        diasTrabalhados,
        valorBruto,
        totalVales,
        liquidoAReceber,
      };
    });

    // Totais Gerais
    const resumoGeral = folha.reduce((acc, f) => {
      acc.totalBruto += f.valorBruto;
      acc.totalVales += f.totalVales;
      acc.totalLiquido += f.liquidoAReceber;
      return acc;
    }, { totalBruto: 0, totalVales: 0, totalLiquido: 0 });

    return NextResponse.json({
      mes,
      ano,
      resumoGeral,
      detalhamento: folha
    });
  } catch (error) {
    console.error('Erro ao gerar relatório Folha de Salários:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
