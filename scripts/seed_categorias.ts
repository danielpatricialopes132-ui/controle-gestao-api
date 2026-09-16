import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const contas = [
  // --- 1. RECEITAS ---
  { codigo: "1.0.0", descricao: "RECEITAS", tipo: "RECEITA" },
  { codigo: "1.1.0", descricao: "Receita de Venda de Obras (Revestimento)", tipo: "RECEITA" },
  { codigo: "1.2.0", descricao: "Receita de Venda de Materiais/Produtos", tipo: "RECEITA" },
  { codigo: "1.3.0", descricao: "Receita de Serviços Avulsos", tipo: "RECEITA" },
  { codigo: "1.4.0", descricao: "Transferência Intercompany (Entrada)", tipo: "RECEITA" },
  { codigo: "1.9.0", descricao: "Outras Receitas Operacionais", tipo: "RECEITA" },

  // --- 2. CUSTOS DIRETOS (OBRAS) ---
  { codigo: "2.0.0", descricao: "CUSTOS DIRETOS (OBRAS)", tipo: "DESPESA" },
  { codigo: "2.1.0", descricao: "Materiais de Construção / Revestimento", tipo: "DESPESA" },
  { codigo: "2.2.0", descricao: "Mão de Obra Terceirizada (Obras)", tipo: "DESPESA" },
  { codigo: "2.3.0", descricao: "Folha de Pagamento (Equipe Campo)", tipo: "DESPESA" },
  { codigo: "2.4.0", descricao: "Locação de Máquinas e Equipamentos", tipo: "DESPESA" },
  { codigo: "2.5.0", descricao: "Combustível, Fretes e Logística (Obras)", tipo: "DESPESA" },
  { codigo: "2.6.0", descricao: "Alimentação e Hospedagem (Obras/Viagem)", tipo: "DESPESA" },

  // --- 3. DESPESAS ADMINISTRATIVAS E FIXAS ---
  { codigo: "3.0.0", descricao: "DESPESAS ADMINISTRATIVAS", tipo: "DESPESA" },
  { codigo: "3.1.0", descricao: "Pré-labore e Folha de Pagamento (Escritório)", tipo: "DESPESA" },
  { codigo: "3.2.0", descricao: "Aluguel, Condomínio e IPTU (Sede)", tipo: "DESPESA" },
  { codigo: "3.3.0", descricao: "Energia, Água, Internet e Telefone", tipo: "DESPESA" },
  { codigo: "3.4.0", descricao: "Material de Escritório e Limpeza", tipo: "DESPESA" },
  { codigo: "3.5.0", descricao: "Softwares e Sistemas (SaaS, Hospedagem)", tipo: "DESPESA" },
  { codigo: "3.6.0", descricao: "Marketing e Anúncios (Tráfego Pago)", tipo: "DESPESA" },
  { codigo: "3.7.0", descricao: "Despesas com Veículos (Manutenção/IPVA)", tipo: "DESPESA" },
  { codigo: "3.8.0", descricao: "Transferência Intercompany (Saída)", tipo: "DESPESA" },

  // --- 4. IMPOSTOS E TAXAS ---
  { codigo: "4.0.0", descricao: "IMPOSTOS E TAXAS", tipo: "DESPESA" },
  { codigo: "4.1.0", descricao: "Impostos sobre Vendas (DAS / NF-e)", tipo: "DESPESA" },
  { codigo: "4.2.0", descricao: "Taxas Bancárias e Juros", tipo: "DESPESA" },
  { codigo: "4.3.0", descricao: "Honorários Contábeis e Advocatícios", tipo: "DESPESA" },

  // --- 5. INVESTIMENTOS E OUTROS ---
  { codigo: "5.0.0", descricao: "INVESTIMENTOS E OUTROS", tipo: "DESPESA" },
  { codigo: "5.1.0", descricao: "Aquisição de Ativos (Máquinas, Veículos)", tipo: "DESPESA" },
  { codigo: "5.2.0", descricao: "Retirada de Lucro / Dividendos", tipo: "DESPESA" }
];

async function main() {
  console.log("Iniciando migração de plano de contas...");

  // Buscar todos os tenants
  const tenants = await prisma.tenant.findMany();
  console.log(`Encontrados ${tenants.length} tenants.`);

  for (const tenant of tenants) {
    console.log(`\nProcessando tenant: ${tenant.nome} (${tenant.id})`);
    
    for (const conta of contas) {
      // Verificar se a conta já existe para este tenant
      const existing = await prisma.categoriaFinanceira.findUnique({
        where: {
          tenantId_codigo: {
            tenantId: tenant.id,
            codigo: conta.codigo
          }
        }
      });

      if (!existing) {
        await prisma.categoriaFinanceira.create({
          data: {
            ...conta,
            tenantId: tenant.id
          }
        });
        console.log(`  [CRIADO] ${conta.codigo} - ${conta.descricao}`);
      } else {
        console.log(`  [IGNORADO - JÁ EXISTE] ${conta.codigo} - ${conta.descricao}`);
      }
    }
  }

  console.log("\nMigração concluída com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro na migração:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
