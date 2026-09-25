import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

async function checkDre() {
  const tenantId = 'e73eecb6-853c-43bc-99bd-7d5ba2d341a8';
  const dataInicio = new Date('2026-01-01T00:00:00.000Z');
  const dataFim = new Date('2026-12-31T23:59:59.999Z');

  const comPagto = await prisma.transacaoFinanceira.count({
    where: {
      tenantId,
      dataPagamento: { gte: dataInicio, lte: dataFim },
      status: 'PAGO'
    }
  });

  const semPagto = await prisma.transacaoFinanceira.findMany({
    where: {
      tenantId,
      dataPagamento: null,
      status: 'PAGO'
    },
    select: { id: true, descricao: true, valor: true, dataVencimento: true }
  });

  console.log(`Transações com dataPagamento em 2026: ${comPagto}`);
  console.log(`Transações PAGAS com dataPagamento NULL: ${semPagto.length}`);
  for (const s of semPagto) {
    console.log(`- ${s.descricao} | R$ ${s.valor} | Venc: ${s.dataVencimento}`);
  }
}

checkDre().finally(() => prisma.$disconnect());
