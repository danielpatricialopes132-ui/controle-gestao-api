import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

async function checkC6() {
  const tenantId = 'e73eecb6-853c-43bc-99bd-7d5ba2d341a8';
  const c6 = await prisma.contaBancaria.findFirst({
    where: { nome: 'C6', tenantId }
  });

  const txs = await prisma.transacaoFinanceira.findMany({
    where: { tenantId, contaBancariaId: c6.id },
    include: { categoriaFk: true }
  });

  console.log(`TOTAL DE TRANSAÇÕES NO C6: ${txs.length}`);
  
  const statusGroup: Record<string, { count: number, rec: number, desp: number }> = {};
  for (const t of txs) {
    if (!statusGroup[t.status]) {
      statusGroup[t.status] = { count: 0, rec: 0, desp: 0 };
    }
    statusGroup[t.status].count++;
    if (t.tipo === 'RECEITA') statusGroup[t.status].rec += Number(t.valor);
    else statusGroup[t.status].desp += Number(t.valor);
  }

  console.log('AGRUPAMENTO POR STATUS NO C6:');
  console.table(statusGroup);

  const cat020 = txs.filter(t => t.categoriaFk?.codigo === '0.2.0');
  console.log(`TRANSAÇÕES 0.2.0 NO C6: ${cat020.length}`);
  for (const t of cat020) {
    console.log(`- ${t.dataVencimento.toISOString().substring(0, 10)} | ${t.status} | ${t.tipo} | R$ ${Number(t.valor).toFixed(2)} | ${t.descricao}`);
  }

  const pessoalTxs = await prisma.transacaoFinanceira.findMany({
    where: { tenantId, contaBancaria: { nome: 'Conta Pessoal' } },
    include: { categoriaFk: true }
  });
  console.log('\nTRANSAÇÕES NA CONTA PESSOAL:');
  for (const t of pessoalTxs) {
    console.log(`- ${t.dataVencimento.toISOString().substring(0, 10)} | ${t.status} | ${t.tipo} | R$ ${Number(t.valor).toFixed(2)} | ${t.categoriaFk?.codigo} | ${t.descricao}`);
  }
}

checkC6().finally(() => prisma.$disconnect());
