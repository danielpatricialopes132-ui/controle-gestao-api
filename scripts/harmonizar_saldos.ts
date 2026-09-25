import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

const TENANT_ID = 'e73eecb6-853c-43bc-99bd-7d5ba2d341a8';

async function fix() {
  console.log('--- APLICANDO AJUSTES DE HIGIENIZAÇÃO CONTÁBIL ---');

  // 1. Marcar a receita de R$ 66.775,00 da Conta Pessoal como 0.2.0 (Isolada do Caixa Operacional da Empresa)
  let cat020 = await prisma.categoriaFinanceira.findFirst({
    where: { codigo: '0.2.0', tenantId: TENANT_ID }
  });

  if (!cat020) {
    cat020 = await prisma.categoriaFinanceira.create({
      data: {
        codigo: '0.2.0',
        descricao: 'Saldo Conta Pessoal (Não Operacional / Histórico)',
        tipo: 'RECEITA',
        tenantId: TENANT_ID
      }
    });
  }

  const tx66k = await prisma.transacaoFinanceira.findFirst({
    where: { valor: 66775, tenantId: TENANT_ID }
  });
  if (tx66k) {
    await prisma.transacaoFinanceira.update({
      where: { id: tx66k.id },
      data: { categoriaId: cat020.id }
    });
    console.log('1. Transação R$ 66.775,00 (Conta Pessoal) classificada como 0.2.0');
  }

  // 2. Transação de R$ 34.692,05 (Fachada) no C6: marcar como PAGO
  const txFachada = await prisma.transacaoFinanceira.findFirst({
    where: { valor: 34692.05, tenantId: TENANT_ID, contaBancaria: { nome: 'C6' } }
  });
  if (txFachada) {
    await prisma.transacaoFinanceira.update({
      where: { id: txFachada.id },
      data: {
        status: 'PAGO',
        dataPagamento: txFachada.dataVencimento
      }
    });
    console.log('2. Transação R$ 34.692,05 (Fachada C6) atualizada para status PAGO');
  }

  // 3. Transações A_CONFIRMAR do C6: atualizar para PAGO
  const txsAConfirmar = await prisma.transacaoFinanceira.findMany({
    where: { tenantId: TENANT_ID, contaBancaria: { nome: 'C6' }, status: 'A_CONFIRMAR' }
  });
  console.log(`3. Atualizando ${txsAConfirmar.length} transações 'A_CONFIRMAR' do C6 para 'PAGO'...`);
  for (const t of txsAConfirmar) {
    await prisma.transacaoFinanceira.update({
      where: { id: t.id },
      data: {
        status: 'PAGO',
        dataPagamento: t.dataVencimento,
        observacao: (t.observacao || '') + ' [A CONFIRMAR PELA DIRETORIA]'
      }
    });
  }

  // 4. Conferir Saldo Calculado do C6 vs Saldo do Dashboard
  const allPaid = await prisma.transacaoFinanceira.findMany({
    where: { tenantId: TENANT_ID, status: 'PAGO' },
    include: { categoriaFk: true, contaBancaria: true }
  });

  let recC6 = 0;
  let despC6 = 0;
  let recGeral = 0;
  let despGeral = 0;

  for (const t of allPaid) {
    if (t.categoriaFk?.codigo === '0.2.0') continue;
    const v = Number(t.valor);
    if (t.tipo === 'RECEITA') {
      recGeral += v;
      if (t.contaBancaria?.nome === 'C6') recC6 += v;
    } else {
      despGeral += v;
      if (t.contaBancaria?.nome === 'C6') despC6 += v;
    }
  }

  console.log('----------------------------------------------------');
  console.log(`C6 Bank: Receitas = R$ ${recC6.toFixed(2)} | Despesas = R$ ${despC6.toFixed(2)} | Saldo = R$ ${(recC6 - despC6).toFixed(2)}`);
  console.log(`Dashboard Geral: Receitas = R$ ${recGeral.toFixed(2)} | Despesas = R$ ${despGeral.toFixed(2)} | Saldo = R$ ${(recGeral - despGeral).toFixed(2)}`);
  console.log(`Extrato C6: R$ 75517.71`);
  console.log('----------------------------------------------------');
}

fix().finally(() => prisma.$disconnect());
