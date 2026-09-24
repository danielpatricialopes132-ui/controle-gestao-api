
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

async function importCSV() {
  const content = fs.readFileSync("c:/Controle-Gestao/transacoes_financeiras (1).csv", "utf8");
  const lines = content.split("\n").filter(l => l.trim().length > 0);
  
  const tenantId = "e73eecb6-853c-43bc-99bd-7d5ba2d341a8";
  const obraId = "c83f4b19-d7e0-461c-b90a-307aff3f9f8a";

  // Find a valid conta
  let conta = await prisma.contaBancaria.findFirst({ where: { tenantId } });
  if (!conta) {
      conta = await prisma.contaBancaria.create({
          data: {
              nome: "Caixa Geral",
              banco: "N/A",
              tenantId
          }
      });
  }
  
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
              obraId,
              tenantId
          }
      });
      count++;
  }
  
  console.log("Imported " + count + " transactions.");
}
importCSV().catch(console.error).finally(() => process.exit());

