
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

async function importCSV() {
  const content = fs.readFileSync("c:/Controle-Gestao/transacoes_financeiras (1).csv", "utf8");
  const lines = content.split("\n").filter(l => l.trim().length > 0);
  
  const tenant = await prisma.tenant.findFirst({ where: { documento: "00000000000000" } });
  if (!tenant) {
      console.log("No tenant found");
      return;
  }
  
  let obra = await prisma.obra.findFirst({ where: { nome: { contains: "Jaqueline" }, tenantId: tenant.id } });
  if (!obra) {
      obra = await prisma.obra.create({
          data: {
              nome: "Jaqueline Baroli",
              tenantId: tenant.id,
              status: "EM_ANDAMENTO"
          }
      });
  }

  // Find a valid conta
  let conta = await prisma.contaBancaria.findFirst({ where: { tenantId: tenant.id } });
  if (!conta) {
      conta = await prisma.contaBancaria.create({
          data: {
              nome: "Caixa Geral",
              banco: "N/A",
              tenantId: tenant.id
          }
      });
  }
  
  console.log("Importing into Obra: " + obra.nome);

  let count = 0;
  for (let i = 1; i < lines.length; i++) {
      let csvLine = lines[i];
      let delimiter = csvLine.includes(";") ? ";" : ",";
      let cols = csvLine.split(delimiter).map(c => c.replace(/^"|"$/g, "").trim());
      
      const tipoStr = cols[0] || "";
      if (!tipoStr.toUpperCase().includes("RECEITA") && !tipoStr.toUpperCase().includes("DESPESA")) {
          // If the first col isn"t Receita/Despesa, it"s probably malformed row
          continue;
      }
      
      const tipo = tipoStr.toUpperCase().includes("RECEITA") ? "RECEITA" : "DESPESA";
      const desc = cols[4] || "Importado do CSV";
      
      let dtVenc = new Date();
      if (cols[5]) {
          const parts = cols[5].split("/");
          if (parts.length === 3) dtVenc = new Date(parts[2], parseInt(parts[1])-1, parts[0]);
      }

      let valStr = cols[7] || "0";
      valStr = valStr.replace(/\./g, "").replace(",", ".");
      const valor = parseFloat(valStr) || 0;
      if (valor === 0) continue;
      
      const status = (cols[8] && cols[8].toUpperCase().includes("PAGO")) ? "PAGO" : "PENDENTE";
      
      let dtPgto = null;
      if (cols[9]) {
          const p = cols[9].split("/");
          if (p.length === 3) dtPgto = new Date(p[2], parseInt(p[1])-1, p[0]);
      }

      await prisma.transacaoFinanceira.create({
          data: {
              tipo,
              descricao: desc,
              valor: valor,
              status,
              dataVencimento: dtVenc,
              dataPagamento: dtPgto,
              contaBancariaId: conta.id,
              obraId: obra.id,
              tenantId: tenant.id
          }
      });
      count++;
  }
  
  console.log("Imported " + count + " transactions.");
}
importCSV().catch(console.error).finally(() => process.exit());

