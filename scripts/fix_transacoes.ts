import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const transacoes = await prisma.transacaoFinanceira.findMany({
    where: {
      categoriaId: null, // Sem categoria
    }
  });

  const categorias = await prisma.categoriaFinanceira.findMany();
  
  let atualizadas = 0;

  for (const transacao of transacoes) {
    let categoriaId: string | null = null;
    
    // Tentar deduzir a categoria pela descrição
    const desc = transacao.descricao.toLowerCase();
    
    if (desc.includes('salário') || desc.includes('pagamento salário')) {
      const cat = categorias.find(c => c.descricao.toLowerCase().includes('salários'));
      if (cat) categoriaId = cat.id;
    } else if (desc.includes('adiantamento') || desc.includes('vale')) {
      const cat = categorias.find(c => c.descricao.toLowerCase().includes('adiantamento') || c.descricao.toLowerCase().includes('vale'));
      if (cat) categoriaId = cat.id;
    } else if (desc.includes('mensalidade contabilidade')) {
      const cat = categorias.find(c => c.descricao.toLowerCase().includes('contabilidade') || c.descricao.toLowerCase().includes('honorários'));
      if (cat) categoriaId = cat.id;
    } else if (desc.includes('despesas gerais')) {
      const cat = categorias.find(c => c.descricao.toLowerCase().includes('viagens') || c.descricao.toLowerCase().includes('despesas diversas'));
      if (cat) categoriaId = cat.id;
    }
    
    if (categoriaId) {
      await prisma.transacaoFinanceira.update({
        where: { id: transacao.id },
        data: { categoriaId: categoriaId }
      });
      atualizadas++;
      console.log(`Transação '${transacao.descricao}' atualizada com a categoria ID: ${categoriaId}`);
    } else {
      console.log(`Não foi possível deduzir categoria para: '${transacao.descricao}'`);
    }
  }

  console.log(`\n${atualizadas} transações atualizadas.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
