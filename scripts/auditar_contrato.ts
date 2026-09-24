import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

async function main() {
  const obra = await prisma.obra.findFirst({ where: { nome: 'Jaqueline Baroli' } });
  const contrato = await prisma.contrato.findFirst({
    where: { obraId: obra.id },
    include: {
      adendos: {
        include: {
          transacaoFinanceiras: true
        }
      }
    }
  });

  console.log('=== CONTRATO PRINCIPAL ===');
  console.log('Obra:', obra.nome);
  console.log('Valor Base: R$', Number(contrato.valor).toFixed(2));
  
  const txsBase = await prisma.transacaoFinanceira.findMany({
    where: { obraId: obra.id, tipo: 'RECEITA', adendoId: null }
  });
  const totalPagoBase = txsBase.reduce((acc, t) => acc + Number(t.valor), 0);
  console.log('Pagamentos vinculados ao Contrato Principal:');
  for (const t of txsBase) {
    console.log(`  - ${t.descricao}: R$ ${Number(t.valor).toFixed(2)}`);
  }
  console.log('Total Recebido na Base: R$', totalPagoBase.toFixed(2));

  console.log('\n=== ADENDOS / SERVIÇOS EXTRAS ===');
  let totalAdendos = 0;
  let totalPagoAdendos = 0;
  for (const a of contrato.adendos) {
    const valAdendo = Number(a.valor);
    totalAdendos += valAdendo;
    const pago = a.transacaoFinanceiras.reduce((acc, t) => acc + Number(t.valor), 0);
    totalPagoAdendos += pago;
    const statusPago = pago >= valAdendo ? 'QUITADO' : (pago > 0 ? `PARCIAL (${((pago/valAdendo)*100).toFixed(1)}%)` : 'PENDENTE');
    console.log(`\n• ${a.descricao}:`);
    console.log(`   Valor Acordado: R$ ${valAdendo.toFixed(2)}`);
    console.log(`   Valor Recebido: R$ ${pago.toFixed(2)} [${statusPago}]`);
    for (const t of a.transacaoFinanceiras) {
      console.log(`     - Pagamento: ${t.descricao} (R$ ${Number(t.valor).toFixed(2)})`);
    }
  }

  console.log('\n================ RESUMO ================');
  console.log('Contrato Principal: R$', Number(contrato.valor).toFixed(2));
  console.log('Total Adendos:      R$', totalAdendos.toFixed(2));
  console.log('Total Contratado:   R$', (Number(contrato.valor) + totalAdendos).toFixed(2));
  console.log('Total Recebido:     R$', (totalPagoBase + totalPagoAdendos).toFixed(2));
  console.log('Saldo a Receber:    R$', ((Number(contrato.valor) + totalAdendos) - (totalPagoBase + totalPagoAdendos)).toFixed(2));
  console.log('========================================');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
