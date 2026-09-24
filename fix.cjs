
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fix() {
  const ecoTenant = "e73eecb6-853c-43bc-99bd-7d5ba2d341a8";
  
  // Update transactions that point to Caixa Geral (Obra)
  const caixaGeralObraId = "0afb9fe9-5b5b-4b34-8b04-91750bf9a9a4";
  const jaquelineRealId = "c83f4b19-d7e0-461c-b90a-307aff3f9f8a";
  
  const res = await prisma.transacaoFinanceira.updateMany({
    where: { obraId: caixaGeralObraId },
    data: { obraId: jaquelineRealId }
  });
  console.log("Updated transactions to Jaqueline:", res.count);

  // Now delete the Caixa Geral Obra
  await prisma.obra.deleteMany({
    where: { id: caixaGeralObraId }
  });
  console.log("Deleted Caixa Geral Obra");
  
  // Also delete the transactions I just imported under the wrong tenant (TESTE LTDA)
  const testeTenant = "e41063c0-9514-4304-813e-4ed3c487535b";
  const fakeJaqueline = await prisma.obra.findFirst({ where: { nome: "Jaqueline Baroli", tenantId: testeTenant }});
  if (fakeJaqueline) {
     const delRes = await prisma.transacaoFinanceira.deleteMany({
         where: { obraId: fakeJaqueline.id, tenantId: testeTenant }
     });
     console.log("Deleted transactions under fake Jaqueline:", delRes.count);
     await prisma.obra.delete({ where: { id: fakeJaqueline.id }});
     console.log("Deleted fake Jaqueline obra");
  }
}
fix().catch(console.error).finally(() => process.exit());

