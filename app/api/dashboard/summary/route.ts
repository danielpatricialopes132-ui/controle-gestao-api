import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    const tenantOverride = request.headers.get('x-tenant-override');
    const tenantId = (userAuth.role === 'MASTER' && tenantOverride) ? tenantOverride : userAuth.tenantId;

    if (userAuth.role === 'MASTER' && !tenantOverride) {
      const totalTenants = await prisma.tenant.count();
      const totalUsers = await prisma.usuario.count();
      return NextResponse.json({
        success: true,
        user: userAuth,
        data: {
          message: "Bem-vindo, Super Administrador!",
          stats: {
            totalEmpresasAtivas: totalTenants,
            totalUsuariosGlobais: totalUsers,
          }
        }
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nome: true }
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado no banco' }, { status: 404 });
    }

    const [qtdObras, qtdClientes, funcionarios, transacoes, obrasAtivasData] = await Promise.all([
      prisma.obra.count({ where: { tenantId } }),
      prisma.cliente.count({ where: { tenantId } }),
      prisma.funcionario.count({ where: { tenantId } }),
      prisma.transacaoFinanceira.findMany({ 
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.obra.findMany({
        where: { tenantId, status: 'EM_ANDAMENTO' }
      })
    ]);

    let receitasPagas = 0.0;
    let despesasPagas = 0.0;
    
    // Contas a pagar agrupadas
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let vencemHoje = 0.0;
    let vencemAmanha = 0.0;
    let vencem3Dias = 0.0;
    let vencem5Dias = 0.0;
    
    let countHoje = 0;
    let countAmanha = 0;
    let count3Dias = 0;
    let count5Dias = 0;

    const ultimasTransacoes = [];
    const valesPendentes = [];

    for (const t of transacoes) {
      const val = Number(t.valor);
      
      if (t.status === 'PAGO') {
        if (t.tipo === 'RECEITA') receitasPagas += val;
        if (t.tipo === 'DESPESA') despesasPagas += val;
      }
      
      if (t.tipo === 'DESPESA' && t.status === 'PENDENTE' && t.dataVencimento) {
        const vDate = new Date(t.dataVencimento);
        const vDay = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
        const diffTime = vDay.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          vencemHoje += val;
          countHoje++;
        } else if (diffDays === 1) {
          vencemAmanha += val;
          countAmanha++;
        } else if (diffDays > 1 && diffDays <= 3) {
          vencem3Dias += val;
          count3Dias++;
        } else if (diffDays > 3 && diffDays <= 5) {
          vencem5Dias += val;
          count5Dias++;
        }
      }

      if (t.categoria === 'PESSOAL' && t.status === 'PENDENTE') {
        valesPendentes.push(t);
      }

      if (ultimasTransacoes.length < 5) {
        ultimasTransacoes.push(t);
      }
    }

    const obrasAtivas = obrasAtivasData.map(o => ({
      id: o.id,
      nome: o.nome,
      cliente: "N/A", // We can fetch from rel if needed
      progressoGeral: Math.round(((o.progressoEscavacao + o.progressoAlvenaria + o.progressoHidraulica + o.progressoRevestimento + o.progressoEntrega) / 5) || 0),
      fases: [
        { nome: 'Escavação', progresso: o.progressoEscavacao },
        { nome: 'Alvenaria', progresso: o.progressoAlvenaria },
        { nome: 'Hidráulica', progresso: o.progressoHidraulica },
        { nome: 'Revestimento', progresso: o.progressoRevestimento },
        { nome: 'Entrega', progresso: o.progressoEntrega },
      ]
    }));

    return NextResponse.json({
      success: true,
      user: userAuth,
      data: {
        empresa: tenant.nome,
        stats: {
          saldoEmCaixa: receitasPagas - despesasPagas,
          obrasAtivas: obrasAtivasData.length,
          colaboradoresAtivos: funcionarios,
          fluxo: {
            receitasPagas,
            despesasPagas
          },
          contasPagar: {
            hoje: { valor: vencemHoje, qtd: countHoje },
            amanha: { valor: vencemAmanha, qtd: countAmanha },
            em3Dias: { valor: vencem3Dias, qtd: count3Dias },
            em5Dias: { valor: vencem5Dias, qtd: count5Dias },
          },
          obras: obrasAtivas,
          ultimasTransacoes,
          viagens: [],
          valesPendentes: valesPendentes.slice(0, 5)
        }
      }
    });

  } catch (error: any) {
    console.error('Erro no Dashboard Summary API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro Interno do Servidor' },
      { status: 401 }
    );
  }
}
