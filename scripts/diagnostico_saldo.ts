import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

async function check() {
  const tenantId = 'e73eecb6-853c-43bc-99bd-7d5ba2d341a8';
  const contas = await prisma.contaBancaria.findMany({ where: { tenantId } });
  console.log('CONTAS BANCÁRIAS:');
  for (const c of contas) {
    const txs = await prisma.transacaoFinanceira.findMany({
      where: { tenantId, contaBancariaId: c.id, status: 'PAGO' }
    });
    let rec = 0;
    let desp = 0;
    for (const t of txs) {
      if (t.tipo === 'RECEITA') rec += Number(t.valor);
      else desp += Number(t.valor);
    }
    const saldo = rec - desp + Number(c.saldoInicial);
    console.log(`- Conta "${c.nome}" (ID: ${c.id}): SaldoInicial=${c.saldoInicial} | Receitas=${rec.toFixed(2)} | Despesas=${desp.toFixed(2)} | Saldo=${saldo.toFixed(2)}`);
  }

  const semConta = await prisma.transacaoFinanceira.findMany({
    where: { tenantId, contaBancariaId: null, status: 'PAGO' }
  });
  let recSem = 0;
  let despSem = 0;
  for (const t of semConta) {
    if (t.tipo === 'RECEITA') recSem += Number(t.valor);
    else despSem += Number(t.valor);
  }
  console.log(`- SEM CONTA BANCÁRIA: Receitas=${recSem.toFixed(2)} | Despesas=${despSem.toFixed(2)} | Saldo=${(recSem - despSem).toFixed(2)}`);
  
  const allPaid = await prisma.transacaoFinanceira.findMany({
    where: { tenantId, status: 'PAGO' },
    include: { categoriaFk: true }
  });
  let totalRec = 0;
  let totalDesp = 0;
  for (const t of allPaid) {
    if (t.categoriaFk?.codigo === '0.2.0') continue;
    if (t.tipo === 'RECEITA') totalRec += Number(t.valor);
    else totalDesp += Number(t.valor);
  }
  console.log('\nDASHBOARD SUMMARY (receitasPagas - despesasPagas de TODAS as contas):');
  console.log('Receitas Pagas:', totalRec.toFixed(2));
  console.log('Despesas Pagas:', totalDesp.toFixed(2));
  console.log('Saldo em Caixa Geral:', (totalRec - totalDesp).toFixed(2));
}

check().finally(() => prisma.$disconnect());
