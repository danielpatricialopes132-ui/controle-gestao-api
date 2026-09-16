import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const prisma = new PrismaClient();

// URL do banco de dados antigo
const oldDbUrl = process.env.DATABASE_URL_OLD || "postgresql://postgres.zybdinuazildvyiqbhjz:6D3mdjk0WP8dyFfW@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({ connectionString: oldDbUrl });

async function main() {
  console.log("Iniciando migração de transações do sistema antigo...");

  // Buscar tenant ECO STONE
  const tenant = await prisma.tenant.findFirst({
    where: { nome: { contains: 'ECO STONE' } }
  });

  if (!tenant) {
    throw new Error("Tenant ECO STONE não encontrado no novo sistema.");
  }
  console.log(`Tenant ECO STONE encontrado: ${tenant.id}`);

  // Carregar mapeamentos do novo sistema
  const categoriasNovas = await prisma.categoriaFinanceira.findMany({
    where: { tenantId: tenant.id }
  });
  const obrasNovas = await prisma.obra.findMany({
    where: { tenantId: tenant.id }
  });

  // Consultar banco antigo
  console.log("Conectando ao banco antigo...");
  const { rows: antigasTransacoes } = await pool.query(`
    SELECT t.*, p.codigo as "planoCodigo", o.nome as "obraNome", f.nome as "funcNome"
    FROM "TransacaoFinanceira" t
    LEFT JOIN "PlanoConta" p ON t."planoContaId" = p.id
    LEFT JOIN "Obra" o ON t."obraId" = o.id
    LEFT JOIN "Funcionario" f ON t."funcionarioId" = f.id
    WHERE t.empresa = 'ECO_STONE'
  `);
  console.log(`Encontradas ${antigasTransacoes.length} transações no banco antigo para ECO_STONE.`);

  let insertedCount = 0;

  for (const t of antigasTransacoes) {
    // Tentar achar a obra
    let obraId = null;
    if (t.obraNome) {
      const match = obrasNovas.find(ob => ob.nome.toLowerCase() === t.obraNome.toLowerCase());
      if (match) obraId = match.id;
    }
    
    // Se não achou a obra exata, podemos pegar a primeira obra só para garantir (ou pular)
    // No nosso caso, todas as transações precisam de obraId
    if (!obraId && obrasNovas.length > 0) {
       // fallback para a obra "Geral" ou a primeira disponível
       obraId = obrasNovas[0].id;
    }

    if (!obraId) {
       console.log(`[AVISO] Ignorando transação ${t.id} pois não há obra disponível no novo sistema.`);
       continue;
    }

    // Achar categoria nova pelo código
    let categoriaId = null;
    if (t.planoCodigo) {
       const match = categoriasNovas.find(c => c.codigo === t.planoCodigo);
       if (match) categoriaId = match.id;
    }

    // Vamos criar o funcionário se ele não existir, apenas para manter a consistência, ou apenas salvar em clienteFornecedor
    const clienteFornecedorStr = t.funcNome ? t.funcNome : t.clienteFornecedor;

    await prisma.transacaoFinanceira.create({
      data: {
        tipo: t.tipo || "DESPESA",
        descricao: t.descricao || "Transação Migrada",
        valor: t.valor || 0,
        dataVencimento: t.dataVencimento ? new Date(t.dataVencimento) : new Date(),
        dataPagamento: t.dataPagamento ? new Date(t.dataPagamento) : null,
        status: t.status || "PENDENTE",
        categoria: t.categoria || null,
        clienteFornecedor: clienteFornecedorStr,
        obraId: obraId,
        categoriaId: categoriaId,
        tenantId: tenant.id,
      }
    });

    insertedCount++;
  }

  console.log(`\nMigração concluída! Foram inseridas ${insertedCount} transações.`);
}

main()
  .catch((e) => {
    console.error("Erro na migração:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
