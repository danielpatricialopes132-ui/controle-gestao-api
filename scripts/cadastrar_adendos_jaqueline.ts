import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

const TENANT_ID = 'e73eecb6-853c-43bc-99bd-7d5ba2d341a8';

const ADENDOS_CONFIG = [
  { descricao: 'Estrutura metálica adicional', valor: 7950.00 },
  { descricao: 'Aumento do muro', valor: 2800.00 },
  { descricao: 'Acabamento interno da casa de máquinas', valor: 3200.00 },
  { descricao: 'Fachada', valor: 69384.10 },
  { descricao: 'Adega', valor: 8000.00 },
  { descricao: 'Aumento superior do muro', valor: 64505.00 },
  { descricao: 'Estrutura de reforço do aumento superior', valor: 11400.00 },
  { descricao: 'Painel de TV', valor: 14550.00 },
];

async function main() {
  console.log('=== ATUALIZANDO CONTRATO E ADENDOS DA OBRA JAQUELINE BAROLI ===');

  const obra = await prisma.obra.findFirst({
    where: { nome: 'Jaqueline Baroli', tenantId: TENANT_ID }
  });
  if (!obra) throw new Error('Obra Jaqueline Baroli não encontrada');

  // 1. Atualizar ou Criar Contrato Principal com Valor Base R$ 97.650,00
  let contrato = await prisma.contrato.findFirst({
    where: { obraId: obra.id, tenantId: TENANT_ID }
  });

  if (!contrato) {
    contrato = await prisma.contrato.create({
      data: {
        descricao: 'Contrato Principal - Jaqueline Baroli',
        valor: 97650.00,
        status: 'ATIVO',
        obraId: obra.id,
        tenantId: TENANT_ID
      }
    });
    console.log(`Contrato Principal criado com sucesso: R$ 97.650,00 (ID: ${contrato.id})`);
  } else {
    contrato = await prisma.contrato.update({
      where: { id: contrato.id },
      data: {
        descricao: 'Contrato Principal - Jaqueline Baroli',
        valor: 97650.00
      }
    });
    console.log(`Contrato Principal atualizado para: R$ 97.650,00 (ID: ${contrato.id})`);
  }

  // 2. Cadastrar / Atualizar Adendos
  const adendosSalvos = [];
  for (const item of ADENDOS_CONFIG) {
    let adendo = await prisma.adendo.findFirst({
      where: {
        contratoId: contrato.id,
        tenantId: TENANT_ID,
        descricao: {
          equals: item.descricao,
          mode: 'insensitive'
        }
      }
    });

    if (adendo) {
      adendo = await prisma.adendo.update({
        where: { id: adendo.id },
        data: { valor: item.valor }
      });
      console.log(`Adendo atualizado: ${adendo.descricao} - R$ ${Number(adendo.valor).toFixed(2)}`);
    } else {
      adendo = await prisma.adendo.create({
        data: {
          descricao: item.descricao,
          valor: item.valor,
          contratoId: contrato.id,
          tenantId: TENANT_ID
        }
      });
      console.log(`Adendo cadastrado: ${adendo.descricao} - R$ ${Number(adendo.valor).toFixed(2)}`);
    }
    adendosSalvos.push(adendo);
  }

  // 3. Vincular Pagamentos existentes aos Adendos e Contrato Principal
  const txs = await prisma.transacaoFinanceira.findMany({
    where: { obraId: obra.id, tipo: 'RECEITA', tenantId: TENANT_ID }
  });

  const findAdendo = (term: string) => {
    return adendosSalvos.find(a => a.descricao.toLowerCase().includes(term.toLowerCase()));
  };

  console.log('\n--- VINCULANDO RECEITAS/PAGAMENTOS AOS ADENDOS ---');
  for (const t of txs) {
    const desc = t.descricao.toLowerCase();
    let adendoIdParaVincular: string | null = null;

    if (desc.includes('estrutura metálica') || desc.includes('estrutura metalica')) {
      adendoIdParaVincular = findAdendo('metálica')?.id || null;
    } else if (desc.includes('aumento superior do muro') || desc.includes('aumento superior')) {
      adendoIdParaVincular = findAdendo('aumento superior do muro')?.id || null;
    } else if (desc.includes('aumento do muro') || desc.includes('aumento muro')) {
      adendoIdParaVincular = findAdendo('aumento do muro')?.id || null;
    } else if (desc.includes('casa de máquinas') || desc.includes('casa de maquinas') || (Number(t.valor) === 3200 && desc.includes('quitação'))) {
      adendoIdParaVincular = findAdendo('casa de máquinas')?.id || null;
    } else if (desc.includes('fachada')) {
      adendoIdParaVincular = findAdendo('fachada')?.id || null;
    } else if (desc.includes('adega')) {
      adendoIdParaVincular = findAdendo('adega')?.id || null;
    } else if (desc.includes('estrutura de reforço') || desc.includes('reforço')) {
      adendoIdParaVincular = findAdendo('estrutura de reforço')?.id || null;
    } else if (desc.includes('painel de tv') || desc.includes('painel')) {
      adendoIdParaVincular = findAdendo('painel de tv')?.id || null;
    }

    if (adendoIdParaVincular) {
      await prisma.transacaoFinanceira.update({
        where: { id: t.id },
        data: { adendoId: adendoIdParaVincular }
      });
      const adNome = adendosSalvos.find(a => a.id === adendoIdParaVincular)?.descricao;
      console.log(`✓ Receita R$ ${Number(t.valor).toFixed(2)} ('${t.descricao}') vinculada ao Aditivo: "${adNome}"`);
    } else {
      await prisma.transacaoFinanceira.update({
        where: { id: t.id },
        data: { adendoId: null }
      });
      console.log(`✓ Receita R$ ${Number(t.valor).toFixed(2)} ('${t.descricao}') vinculada ao Contrato Principal`);
    }
  }

  // 4. Somatório e Conferência
  const totalAdendos = adendosSalvos.reduce((acc, a) => acc + Number(a.valor), 0);
  const totalGeral = 97650.00 + totalAdendos;

  console.log('\n================ RESUMO FINAL ================');
  console.log(`Valor Base do Contrato:   R$  97.650,00`);
  console.log(`Total Adendos (8 itens):  R$ ${totalAdendos.toFixed(2)}`);
  console.log(`Total Geral (Base+Adendos): R$ ${totalGeral.toFixed(2)}`);
  console.log(`Conferência solicitada:   R$ 279.439,10`);
  console.log(`Diferença:                R$ ${(totalGeral - 279439.10).toFixed(2)}`);
  console.log('==============================================');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
