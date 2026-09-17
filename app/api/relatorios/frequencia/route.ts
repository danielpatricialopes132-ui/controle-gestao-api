import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    const { searchParams } = new URL(request.url);
    const mesStr = searchParams.get('mes');
    const anoStr = searchParams.get('ano');
    const obraId = searchParams.get('obraId');

    if (!mesStr || !anoStr) {
      return NextResponse.json({ success: false, error: 'Mês e ano são obrigatórios' }, { status: 400 });
    }

    const mes = parseInt(mesStr);
    const ano = parseInt(anoStr);
    
    // First day of the month
    const dataInicio = new Date(ano, mes - 1, 1);
    // Last day of the month
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);

    // Fetch all employees for the tenant
    const funcionarios = await prisma.funcionario.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
    });

    // Fetch presences in the period
    const presencasWhere: any = {
      tenantId,
      data: {
        gte: dataInicio,
        lte: dataFim,
      },
      statusAprovacao: 'APROVADO' // Only approved attendances? Or all? Let's take all for now, maybe only approved later. For now, let's take all to match legacy, or we can filter by APROVADO if required. Let's not filter by APROVADO for now to avoid missing data if they don't use approval flow.
    };

    if (obraId) {
      presencasWhere.obraId = obraId;
    }

    const registros = await prisma.registroPresenca.findMany({
      where: presencasWhere,
    });

    // Map the results
    // Return array: { id, nome, dias: { '1': 'T', '2': 'V', ... }, totalDiasTrabalhados }
    
    const mapStatus = (status: string) => {
      switch (status) {
        case 'TRABALHO': return 'T';
        case 'VIAGEM': return 'V';
        case 'CHUVA': return 'CH';
        case 'FALTA': return '-';
        default: return '-';
      }
    };

    const resultado = funcionarios.map(func => {
      const funcRegistros = registros.filter(r => r.funcionarioId === func.id);
      const dias: Record<string, string> = {};
      let totalTrabalhados = 0;

      for (const reg of funcRegistros) {
        const dia = reg.data.getDate().toString();
        const sigla = mapStatus(reg.status);
        dias[dia] = sigla;
        
        if (reg.status === 'TRABALHO') {
          totalTrabalhados += 1;
        }
      }

      return {
        id: func.id,
        nome: func.nome,
        cargo: func.cargo,
        dias,
        totalDiasTrabalhados: totalTrabalhados,
      };
    });

    return NextResponse.json({ success: true, data: resultado });
  } catch (error: any) {
    console.error('Erro em relatorios/frequencia:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
