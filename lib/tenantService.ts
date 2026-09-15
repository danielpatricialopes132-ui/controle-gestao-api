import prisma from "./prisma";

/**
 * Cria um novo Tenant (Empresa) e já popula automaticamente
 * o Plano de Contas Padrão (Focado em Obras/Engenharia).
 */
export async function createTenantWithDefaults(nome: string, documento?: string) {
  // O Prisma 8 permite fazer isso tudo dentro de uma transação garantida
  const tenant = await prisma.tenant.create({
    data: {
      nome,
      documento,
      planosConta: {
        create: [
          { nome: "Contratos de Obra", tipo: "RECEITA" },
          { nome: "Aditivos e Extras", tipo: "RECEITA" },
          { nome: "Outras Receitas", tipo: "RECEITA" },
          
          { nome: "Mão de Obra (Folha)", tipo: "DESPESA" },
          { nome: "Mão de Obra (Terceiros)", tipo: "DESPESA" },
          { nome: "Material de Construção", tipo: "DESPESA" },
          { nome: "Locação de Equipamentos", tipo: "DESPESA" },
          { nome: "Alimentação / Refeição", tipo: "DESPESA" },
          { nome: "Vales e Adiantamentos", tipo: "DESPESA" },
          { nome: "Custos Fixos (Água, Luz, Net)", tipo: "DESPESA" },
          { nome: "Impostos e Taxas", tipo: "DESPESA" },
        ],
      },
    },
  });

  return tenant;
}
