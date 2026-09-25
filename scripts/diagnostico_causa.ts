import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

async function findDiff() {
  const tenantId = 'e73eecb6-853c-43bc-99bd-7d5ba2d341a8';
  const allPaid = await prisma.transacaoFinanceira.findMany({
    where: { tenantId, status: 'PAGO' },
    include: { categoriaFk: true, contaBancaria: true }
  });
  
  let recPagas = 0;
  let despPagas = 0;
  for (const t of allPaid) {
    if (t.categoriaFk?.codigo === '0.2.0') continue;
    if (t.tipo === 'RECEITA') recPagas += Number(t.valor);
    else despPagas += Number(t.valor);
  }
  console.log('RECEITAS PAGAS (não 0.2.0):', recPagas);
  console.log('DESPESAS PAGAS (não 0.2.0):', despPagas);
  console.log('SALDO EM CAIXA:', recPagas - despPagas);

  const receitasPorConta: Record<string, number> = {};
  for (const t of allPaid) {
    if (t.categoriaFk?.codigo === '0.2.0') continue;
    if (t.tipo === 'RECEITA') {
      const conta = t.contaBancaria?.nome || 'SEM_CONTA';
      receitasPorConta[conta] = (receitasPorConta[conta] || 0) + Number(t.valor);
    }
  }
  console.log('RECEITAS POR CONTA (excluindo 0.2.0):', receitasPorConta);

  console.log('\nRECEITAS DA CONTA PESSOAL QUE NÃO SÃO 0.2.0:');
  const recPessoal = allPaid.filter(t => t.contaBancaria?.nome === 'Conta Pessoal' && t.tipo === 'RECEITA' && t.categoriaFk?.codigo !== '0.2.0');
  for (const r of recPessoal) {
    console.log(`- ${r.dataVencimento.toISOString().substring(0, 10)} | R$ ${Number(r.valor).toFixed(2)} | cat: ${r.categoriaFk?.codigo} | ${r.descricao}`);
  }

  console.log('\nTRANSAÇÕES NO C6 COM STATUS DIFERENTE DE PAGO:');
  const notPaidC6 = await prisma.transacaoFinanceira.findMany({
    where: { tenantId, contaBancaria: { nome: 'C6' }, status: { not: 'PAGO' } },
    include: { categoriaFk: true }
  });
  for (const n of notPaidC6) {
    console.log(`- ${n.dataVencimento.toISOString().substring(0, 10)} | ${n.status} | ${n.tipo} | R$ ${Number(n.valor).toFixed(2)} | ${n.categoriaFk?.codigo} | ${n.descricao}`);
  }
}

findDiff().finally(() => prisma.$disconnect());
