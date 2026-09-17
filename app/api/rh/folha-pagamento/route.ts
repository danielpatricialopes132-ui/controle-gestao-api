import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const { searchParams } = new URL(request.url);
    const dataInicioStr = searchParams.get('dataInicio');
    const dataFimStr = searchParams.get('dataFim');

    if (!dataInicioStr || !dataFimStr) {
      return NextResponse.json({ success: false, error: 'Datas inválidas' }, { status: 400 });
    }

    const dataInicio = new Date(dataInicioStr);
    const dataFim = new Date(dataFimStr);

    const funcionarios = await prisma.funcionario.findMany({
      where: { tenantId: userAuth.tenantId },
      include: {
        registrosPresenca: {
          where: {
            data: {
              gte: dataInicio,
              lte: dataFim
            }
          }
        }
      }
    });

    const folha = funcionarios.map(func => {
      let totalHoras = 0;
      let totalFaltas = 0;
      let diasTrabalhados = 0;

      for (const reg of func.registrosPresenca) {
        if (reg.status === 'TRABALHO') {
          totalHoras += Number(reg.horasTrabalhadas || 8);
          diasTrabalhados++;
        } else if (reg.status === 'FALTA') {
          totalFaltas++;
        }
      }

      let valorSugerido = 0;
      let salarioBase = 0;

      if (func.tipoPagamento === 'MENSAL') {
        salarioBase = Number(func.salario || 0);
        const valorPorDia = salarioBase / 30;
        valorSugerido = salarioBase - (totalFaltas * valorPorDia);
      } else if (func.tipoPagamento === 'DIARISTA') {
        const valorDiaria = Number(func.valorDiaria || 0);
        const valorMotorista = Number(func.valorDiariaMotorista || 0);
        const diáriaTotal = valorDiaria + valorMotorista;
        
        // Assume 8 hours = 1 day. 
        // Se trabalhou 4 horas, = 0.5 dia.
        const diasEquivalentes = totalHoras / 8;
        valorSugerido = diasEquivalentes * diáriaTotal;
        salarioBase = diáriaTotal; // Mostrar o valor da diária como base
      }

      // Evita valores negativos
      if (valorSugerido < 0) valorSugerido = 0;

      return {
        funcionario: {
          id: func.id,
          nome: func.nome,
          cargo: func.cargo,
          tipoPagamento: func.tipoPagamento,
        },
        estatisticas: {
          diasTrabalhados,
          totalHoras,
          totalFaltas,
          registrosAprovados: func.registrosPresenca.filter(r => r.statusAprovacao === 'APROVADO').length,
          registrosPendentes: func.registrosPresenca.filter(r => r.statusAprovacao === 'PENDENTE').length,
        },
        financeiro: {
          base: salarioBase,
          valorSugerido: Number(valorSugerido.toFixed(2)),
          valorAjustado: Number(valorSugerido.toFixed(2)), // Para o frontend modificar se quiser
        }
      };
    });

    return NextResponse.json({ success: true, data: folha });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
