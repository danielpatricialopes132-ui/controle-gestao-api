import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

async function run() {
  const tx = await prisma.transacaoFinanceira.findFirst({
    where: { valor: 34692.05 },
    include: { contaBancaria: true, categoriaFk: true }
  });
  console.log('TRANSACAO 34692.05:');
  console.log(tx);

  const tx66 = await prisma.transacaoFinanceira.findFirst({
    where: { valor: 66775 },
    include: { contaBancaria: true, categoriaFk: true }
  });
  console.log('\nTRANSACAO 66775:');
  console.log(tx66);
}

run().finally(() => prisma.$disconnect());
