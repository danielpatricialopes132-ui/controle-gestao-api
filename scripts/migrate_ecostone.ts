import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { randomUUID } from 'crypto';

const newPrisma = new PrismaClient();

const OLD_DB_URL = "postgresql://postgres.zybdinuazildvyiqbhjz:6D3mdjk0WP8dyFfW@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&statement_cache_size=0";

async function main() {
  console.log('Iniciando migração da ECO STONE...');

  const oldDb = new Client({
    connectionString: OLD_DB_URL,
  });

  await oldDb.connect();
  console.log('Conectado ao banco antigo!');

  // 1. Criar/Buscar Tenant
  let tenant = await newPrisma.tenant.findFirst({
    where: { nome: 'ECO STONE' },
  });

  if (!tenant) {
    tenant = await newPrisma.tenant.create({
      data: {
        nome: 'ECO STONE',
        documento: '00000000000100', // Placeholder
      },
    });
    console.log(`Tenant ECO STONE criado com ID: ${tenant.id}`);
  } else {
    console.log(`Tenant ECO STONE encontrado com ID: ${tenant.id}`);
  }

  // 2. Migrar Obras
  console.log('Migrando Obras...');
  const obrasResult = await oldDb.query(`SELECT * FROM "Obra" WHERE empresa = 'ECO_STONE'`);
  const oldObras = obrasResult.rows;
  
  // Mapa de IDs antigos para IDs novos para usar nas outras migrações
  const mapObras = new Map<number, string>();

  for (const oldObra of oldObras) {
    let novaObra = await newPrisma.obra.findFirst({
      where: { nome: oldObra.nome, tenantId: tenant.id },
    });

    if (!novaObra) {
      novaObra = await newPrisma.obra.create({
        data: {
          nome: oldObra.nome,
          status: oldObra.status === 'FINALIZADA' ? 'CONCLUIDA' : (oldObra.status === 'SUSPENSA' ? 'CANCELADA' : 'EM_ANDAMENTO'),
          endereco: oldObra.endereco,
          tenantId: tenant.id,
          createdAt: oldObra.createdAt,
          updatedAt: oldObra.updatedAt,
        },
      });
    }
    mapObras.set(oldObra.id, novaObra.id);
  }
  console.log(`${oldObras.length} obras migradas.`);

  // 3. Migrar Funcionários
  console.log('Migrando Funcionários...');
  const funcResult = await oldDb.query(`SELECT * FROM "Funcionario" WHERE empresa = 'ECO_STONE'`);
  const oldFuncs = funcResult.rows;

  const mapFuncs = new Map<number, string>();

  for (const oldFunc of oldFuncs) {
    let novoFunc = await newPrisma.funcionario.findFirst({
      where: { nome: oldFunc.nome, tenantId: tenant.id },
    });

    if (!novoFunc) {
      novoFunc = await newPrisma.funcionario.create({
        data: {
          nome: oldFunc.nome,
          cargo: oldFunc.cargo || 'Funcionario',
          salario: oldFunc.salarioFixo || 0,
          valorDiariaMotorista: oldFunc.diariaPadrao || 0,
          tenantId: tenant.id,
          createdAt: oldFunc.createdAt,
          updatedAt: oldFunc.updatedAt,
        },
      });
    }
    mapFuncs.set(oldFunc.id, novoFunc.id);
  }
  console.log(`${oldFuncs.length} funcionários migrados.`);

  // 4. Migrar Pontos (Presenças)
  console.log('Migrando Pontos (RegistroPonto)...');
  const pontosResult = await oldDb.query(`
    SELECT rp.* FROM "RegistroPonto" rp
    JOIN "Funcionario" f ON rp."funcionarioId" = f.id
    WHERE f.empresa = 'ECO_STONE'
  `);
  const oldPontos = pontosResult.rows;

  let pontosMigrados = 0;
  for (const oldPonto of oldPontos) {
    const novoFuncId = mapFuncs.get(oldPonto.funcionarioId);
    const novaObraId = mapObras.get(oldPonto.obraId);

    if (!novoFuncId || !novaObraId) continue; // Pula se faltar dependência

    // Determinar status (TRABALHO -> PRESENTE, FALTA -> FALTA, etc)
    let novoStatus = 'PRESENTE';
    if (oldPonto.tipoDia === 'FALTA') novoStatus = 'FALTA';
    else if (oldPonto.tipoDia === 'CHUVA') novoStatus = 'CHUVA';
    else if (oldPonto.horasTrabalhadas > 0 && oldPonto.horasTrabalhadas < 8) novoStatus = 'MEIO_DIA';

    // Verificar se já existe para evitar duplicatas (usando data e funcionario)
    const exists = await newPrisma.registroPresenca.findFirst({
      where: { 
        data: oldPonto.data, 
        funcionarioId: novoFuncId, 
        tenantId: tenant.id 
      }
    });

    if (!exists) {
      await newPrisma.registroPresenca.create({
        data: {
          data: oldPonto.data,
          status: novoStatus,
          observacao: oldPonto.observacoes,
          funcionarioId: novoFuncId,
          obraId: novaObraId,
          tenantId: tenant.id,
        }
      });
      pontosMigrados++;
    }
  }
  console.log(`${pontosMigrados} registros de presença migrados.`);

  // 5. Migrar Transações Financeiras
  console.log('Migrando Transações Financeiras...');
  const transacoesResult = await oldDb.query(`SELECT * FROM "TransacaoFinanceira" WHERE empresa = 'ECO_STONE'`);
  const oldTransacoes = transacoesResult.rows;

  let transacoesMigradas = 0;
  for (const oldTransacao of oldTransacoes) {
    const novaObraId = mapObras.get(oldTransacao.obraId);

    if (!novaObraId) continue; // Precisa de uma obra no novo sistema

    // Determinar categoria (PESSOAL, FORNECEDOR, MATERIAL, ADENDO, CONTRATO_PRINCIPAL)
    let novaCategoria = 'MATERIAL'; // Default
    const categoriaAntiga = (oldTransacao.categoria || '').toLowerCase();
    
    if (categoriaAntiga.includes('pessoal') || categoriaAntiga.includes('salario') || categoriaAntiga.includes('vale') || oldTransacao.funcionarioId != null) {
      novaCategoria = 'PESSOAL';
    } else if (categoriaAntiga.includes('fornecedor') || oldTransacao.fornecedorId != null) {
      novaCategoria = 'FORNECEDOR';
    } else if (categoriaAntiga.includes('adendo')) {
      novaCategoria = 'ADENDO';
    } else if (categoriaAntiga.includes('cliente') || oldTransacao.tipo === 'RECEITA') {
      novaCategoria = 'CONTRATO_PRINCIPAL';
    }

    const exists = await newPrisma.transacaoFinanceira.findFirst({
      where: {
        obraId: novaObraId,
        valor: oldTransacao.valor,
        descricao: oldTransacao.descricao,
        tipo: oldTransacao.tipo,
        tenantId: tenant.id
      }
    });

    if (!exists) {
      await newPrisma.transacaoFinanceira.create({
        data: {
          tipo: oldTransacao.tipo,
          categoria: novaCategoria,
          descricao: oldTransacao.descricao,
          valor: oldTransacao.valor,
          dataVencimento: oldTransacao.dataVencimento,
          dataPagamento: oldTransacao.dataPagamento,
          status: oldTransacao.status === 'PAGO' ? 'PAGO' : (oldTransacao.status === 'ATRASADO' ? 'PENDENTE' : 'PENDENTE'),
          obraId: novaObraId,
          tenantId: tenant.id,
          createdAt: oldTransacao.createdAt,
        }
      });
      transacoesMigradas++;
    }
  }
  console.log(`${transacoesMigradas} transações financeiras migradas.`);

  console.log('Migração finalizada com sucesso!');
  await oldDb.end();
  await newPrisma.$disconnect();
}

main().catch(e => {
  console.error('Erro na migração:', e);
  process.exit(1);
});
