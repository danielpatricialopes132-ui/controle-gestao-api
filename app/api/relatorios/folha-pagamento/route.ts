import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    const tenantId = userAuth.tenantId;

    const { searchParams } = new URL(request.url);
    const dataInicioStr = searchParams.get('dataInicio');
    const dataFimStr = searchParams.get('dataFim');

    if (!dataInicioStr || !dataFimStr) {
      return NextResponse.json({ success: false, error: 'Datas de início e fim são obrigatórias' }, { status: 400 });
    }

    const dataInicio = new Date(dataInicioStr);
    const dataFim = new Date(dataFimStr);
    // Ensure dataFim includes the whole day
    dataFim.setHours(23, 59, 59, 999);

    // Fetch all employees
    const funcionarios = await prisma.funcionario.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
    });

    // Fetch presences
    const registros = await prisma.registroPresenca.findMany({
      where: {
        tenantId,
        data: {
          gte: dataInicio,
          lte: dataFim,
        },
      }
    });

    // Fetch Vales (TransacaoFinanceira with categoria = PESSOAL and it's a vale)
    // Assuming Vales have a specific status or we just grab all DESPESAS linked to the user
    // In our previous fix, Vales were created with descricao = 'Adiantamento / Vale' and categoria = 'PESSOAL'
    const transacoesFuncionario = await prisma.transacaoFinanceira.findMany({
      where: {
        tenantId,
        funcionarioId: { not: null },
        dataVencimento: {
          gte: dataInicio,
          lte: dataFim,
        },
        tipo: 'DESPESA',
      }
    });

    const resultado = funcionarios.map(func => {
      const funcRegistros = registros.filter(r => r.funcionarioId === func.id);
      const funcTransacoes = transacoesFuncionario.filter(t => t.funcionarioId === func.id);
      
      let diasTrabalhados = 0;
      let diasViagem = 0;

      for (const reg of funcRegistros) {
        if (reg.status === 'TRABALHO') diasTrabalhados++;
        if (reg.status === 'VIAGEM') diasViagem++;
      }

      // Calculation logic
      let ganhosPonto = 0;
      if (func.tipoPagamento === 'MENSAL') {
        ganhosPonto = func.salario ? Number(func.salario) : 0;
        // Se quiser pro-rata, pode dividir por 30, mas no legado o salário base vinha fixo
      } else {
        ganhosPonto = (func.valorDiaria ? Number(func.valorDiaria) : 0) * diasTrabalhados;
      }

      // Taxa de viagem - vamos considerar que o valor da diária de motorista seja a taxa de viagem
      // ou um valor fixo. O legado não mostrava o valor por viagem. Assumimos valorDiariaMotorista ou um default.
      const taxaViagem = func.valorDiariaMotorista ? Number(func.valorDiariaMotorista) : 50; 
      const ganhosViagem = diasViagem * taxaViagem;

      // Vales
      const vales = funcTransacoes
        .filter(t => (t.descricao?.toLowerCase().includes('vale') || t.descricao?.toLowerCase().includes('adiantamento')))
        .reduce((sum, t) => sum + Number(t.valor), 0);

      // Bônus
      const bonus = funcTransacoes
        .filter(t => t.descricao?.toLowerCase().includes('bônus') || t.descricao?.toLowerCase().includes('premio'))
        .reduce((sum, t) => sum + Number(t.valor), 0);
        
      // Já Pago (Salário efetivamente pago no caixa para o mês)
      const jaPago = funcTransacoes
        .filter(t => t.status === 'PAGO' && t.descricao?.toLowerCase().includes('salário'))
        .reduce((sum, t) => sum + Number(t.valor), 0);

      const totalReceber = ganhosPonto + ganhosViagem + bonus;
      const saldo = totalReceber - vales - jaPago;

      return {
        id: func.id,
        nome: func.nome,
        cargo: func.cargo,
        tipoPagamento: func.tipoPagamento,
        ganhosPonto,
        ganhosViagem,
        bonus,
        vales,
        totalReceber,
        jaPago,
        saldo,
      };
    });

    return NextResponse.json({ success: true, data: resultado });
  } catch (error: any) {
    console.error('Erro em relatorios/folha-pagamento:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
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
