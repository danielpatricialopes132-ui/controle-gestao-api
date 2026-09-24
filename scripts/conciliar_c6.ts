import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

const TENANT_ID = 'e73eecb6-853c-43bc-99bd-7d5ba2d341a8';

// IDs dos Planos de Contas mapeados
const CAT_IDS = {
  // Custos Diretos
  MATERIAIS: '7e714a04-94d3-4bd1-a017-b344f4a002bb', // 2.1.0 Materiais de Construção / Revestimento
  MAO_OBRA_TERCEIRIZADA: '805b4090-d8c9-4f53-9428-feec6d9a39b5', // 2.2.0 Mão de Obra Terceirizada (Obras)
  FOLHA_CAMPO: '14ac7fc8-15b0-4bd0-a663-0bcc0862d23c', // 2.3.0 Folha de Pagamento (Equipe Campo)
  COMBUSTIVEL_LOGISTICA: '597b2566-85dc-4c37-a295-98461b7213a7', // 2.5.0 Combustível, Fretes e Logística (Obras)
  ALIMENTACAO_HOSPEDAGEM: '9548ec0c-b22d-4217-8b65-9ec1b10e4ec3', // 2.6.0 Alimentação e Hospedagem (Obras/Viagem)
  DESPESAS_GERAIS_OBRA: 'e3bc8a08-8237-4cb7-84c3-c997a1b92cd4', // 2.7.0 Despesas Gerais (não especificadas - Obra/ Viagem)
  
  // Despesas Administrativas
  PRO_LABORE_ADM: 'bdbd88ba-a87c-473e-8df5-24b07c706f74', // 3.1.0 Pré-labore e Folha de Pagamento (Escritório)
  TELEFONIA_COMUNICACAO: '2298e24c-c1a5-45ca-85de-77c6cc1845de', // 3.3.0 Energia, Água, Internet e Telefone
  DESPESAS_VEICULOS: '5b223b0b-dd59-43b9-8cf6-1b2880696aeb', // 3.7.0 Despesas com Veículos (Manutenção/IPVA)
  
  // Impostos e Taxas
  IMPOSTOS_FEDERAIS: '410ebd8a-b144-4fec-816a-0b680abe204e', // fallback ou 4.1.0 / 4.0.0
  IMPOSTOS_TAXAS: '5c2b3726-89c3-4670-a9dd-7acc9e377e47', // 4.0.0 IMPOSTOS E TAXAS
  HONORARIOS_CONTABEIS: 'a7acefad-7cb9-4526-b54e-7dae793b45ca', // 4.3.1 Mensalidade Contábil
  
  // Investimentos / Retiradas
  RETIRADA_LUCRO: '66127e17-fa4f-4f93-b3f9-2b18fadb6814', // 5.2.0 Retirada de Lucro / Dividendos
  
  // Saldo
  SALDO_ANTERIOR: '73950033-0c03-4c09-80fa-8a1f4766d1bf', // 0.1.0 Saldo Conta Anterior
};

async function main() {
  console.log('--- INICIANDO CONCILIAÇÃO BANCÁRIA C6 DO DIA 05/09/2026 EM DIANTE ---');

  const c6 = await prisma.contaBancaria.findFirst({
    where: { nome: 'C6', tenantId: TENANT_ID }
  });
  if (!c6) throw new Error('Conta C6 não encontrada');

  const obraNova = await prisma.obra.findFirst({
    where: { nome: 'NOVA', tenantId: TENANT_ID }
  });
  if (!obraNova) throw new Error('Obra NOVA não encontrada');

  const obraJaqueline = await prisma.obra.findFirst({
    where: { nome: 'Jaqueline Baroli', tenantId: TENANT_ID }
  });

  const funcs = await prisma.funcionario.findMany({
    where: { tenantId: TENANT_ID }
  });

  const getFuncId = (nomeBusca: string) => {
    const f = funcs.find(x => x.nome.toLowerCase().includes(nomeBusca.toLowerCase()));
    return f ? f.id : null;
  };

  // 1. Zerar saldoInicial da conta C6 para que o saldo inicial venha exclusivamente da transação de Saldo Anterior R$ 44,16
  await prisma.contaBancaria.update({
    where: { id: c6.id },
    data: { saldoInicial: 0 }
  });
  console.log('1. Saldo inicial da conta C6 ajustado para 0 (para evitar duplicidade com a transação R$ 44,16).');

  // 2. Ajustar transações de folha existentes que estavam com descrição genérica "Salário"
  const txLuan2000 = await prisma.transacaoFinanceira.findFirst({
    where: { tenantId: TENANT_ID, valor: 2000, tipo: 'DESPESA', dataVencimento: new Date('2026-09-05T03:00:00.000Z') }
  });
  if (txLuan2000) {
    await prisma.transacaoFinanceira.update({
      where: { id: txLuan2000.id },
      data: {
        descricao: 'Pagamento Salário - Luan Faria Ramos Costa',
        funcionarioId: getFuncId('Luan'),
        status: 'PAGO'
      }
    });
    console.log('2. Atualizado Luan Faria R$ 2000');
  }

  const txCauan130 = await prisma.transacaoFinanceira.findFirst({
    where: { tenantId: TENANT_ID, valor: 130, tipo: 'DESPESA', dataVencimento: new Date('2026-09-05T03:00:00.000Z') }
  });
  if (txCauan130) {
    await prisma.transacaoFinanceira.update({
      where: { id: txCauan130.id },
      data: {
        descricao: 'Pagamento Salário - Cauan Bruno Schiavon da Silva',
        funcionarioId: getFuncId('Cauan'),
        status: 'PAGO'
      }
    });
    console.log('3. Atualizado Cauan Bruno R$ 130');
  }

  // 3. Definir todas as novas transações extraídas do Extrato C6 (08/09 a 23/09)
  interface NovaTransacao {
    data: string; // YYYY-MM-DD
    descricao: string;
    valor: number;
    tipo: 'DESPESA' | 'RECEITA';
    categoriaId: string;
    obraId: string | null;
    funcionarioId?: string | null;
    clienteFornecedor?: string | null;
    status: 'PAGO' | 'PENDENTE' | 'A_CONFIRMAR';
    observacao?: string;
  }

  const novasTransacoes: NovaTransacao[] = [
    // 08/09/2026
    {
      data: '2026-09-08',
      descricao: 'Débito de Cartão - SUPERMERCADO STA ROSA NEVES PAULIST BRA',
      valor: 476.50,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'SUPERMERCADO STA ROSA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    // 09/09/2026
    {
      data: '2026-09-09',
      descricao: 'Débito de Cartão - JM NEVENSE SUPERMERCAD NEVES PAULIST BRA',
      valor: 176.13,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'JM NEVENSE SUPERMERCAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-09',
      descricao: 'Débito de Cartão - COSTA RODRIGUES & CIA NEVES PAULIST BRA',
      valor: 2540.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MATERIAIS,
      obraId: obraNova.id,
      clienteFornecedor: 'COSTA RODRIGUES & CIA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-09',
      descricao: 'Débito de Cartão - AraujoTorres BARBOSA BRA',
      valor: 200.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_GERAIS_OBRA,
      obraId: obraNova.id,
      clienteFornecedor: 'AraujoTorres',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    {
      data: '2026-09-09',
      descricao: 'Débito de Cartão - AUTO POSTO PAGANO II CRAVINHOS BRA',
      valor: 100.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.COMBUSTIVEL_LOGISTICA,
      obraId: obraNova.id,
      clienteFornecedor: 'AUTO POSTO PAGANO II',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    // 11/09/2026
    {
      data: '2026-09-11',
      descricao: 'Débito de Cartão - AUTO POSTO BRASIL PETR MONTE SANTO D BRA',
      valor: 100.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.COMBUSTIVEL_LOGISTICA,
      obraId: obraNova.id,
      clienteFornecedor: 'AUTO POSTO BRASIL PETR',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-11',
      descricao: 'Débito de Cartão - MAIS SUPERMERCADO GUAXUPE BRA',
      valor: 36.97,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'MAIS SUPERMERCADO',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-11',
      descricao: 'Débito de Cartão - EmersonBento GUAXUPE BRA',
      valor: 64.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_GERAIS_OBRA,
      obraId: obraNova.id,
      clienteFornecedor: 'EmersonBento',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    // 12/09/2026
    {
      data: '2026-09-12',
      descricao: 'Débito de Cartão - PANIFICADORA ESPERANCA Monte Santo d BRA',
      valor: 24.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'PANIFICADORA ESPERANCA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    // 13/09/2026
    {
      data: '2026-09-13',
      descricao: 'Débito de Cartão - MAIS SUPERMERCADO GUAXUPE BRA',
      valor: 47.17,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'MAIS SUPERMERCADO',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-13',
      descricao: 'Débito de Cartão - LIDIANECRISTINAAG GUAXUPE BRA',
      valor: 45.90,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'LIDIANECRISTINAAG',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    {
      data: '2026-09-13',
      descricao: 'Débito de Cartão - EXPRESSO CONV E SERVIC GUAXUPE BRA',
      valor: 100.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.COMBUSTIVEL_LOGISTICA,
      obraId: obraNova.id,
      clienteFornecedor: 'EXPRESSO CONV E SERVIC',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-13',
      descricao: 'Débito de Cartão - BRUNO FRANCISCO DE SOU GUAXUPE BRA',
      valor: 50.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'BRUNO FRANCISCO DE SOU',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    {
      data: '2026-09-13',
      descricao: 'Débito de Cartão - DROGARIA ISIS GUAXUPE BRA',
      valor: 32.18,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_GERAIS_OBRA,
      obraId: obraNova.id,
      clienteFornecedor: 'DROGARIA ISIS',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    {
      data: '2026-09-13',
      descricao: 'Débito de Cartão - DROGARIA ISIS GUAXUPE BRA',
      valor: 33.84,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_GERAIS_OBRA,
      obraId: obraNova.id,
      clienteFornecedor: 'DROGARIA ISIS',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    // 14/09/2026
    {
      data: '2026-09-14',
      descricao: 'Débito de Cartão - AUTO POSTO BRASIL PETR MONTE SANTO D BRA',
      valor: 100.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.COMBUSTIVEL_LOGISTICA,
      obraId: obraNova.id,
      clienteFornecedor: 'AUTO POSTO BRASIL PETR',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-14',
      descricao: 'Débito de Cartão - RESTAURANTE E LANCHONE Santa Adelia BRA',
      valor: 78.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'RESTAURANTE E LANCHONE',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-14',
      descricao: 'Débito de Cartão - WlaParticipacoes SAO PAULO BRA',
      valor: 250.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_GERAIS_OBRA,
      obraId: obraNova.id,
      clienteFornecedor: 'WlaParticipacoes',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    {
      data: '2026-09-14',
      descricao: 'Débito de Cartão - JM NEVENSE SUPERMERCAD NEVES PAULIST BRA',
      valor: 69.16,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'JM NEVENSE SUPERMERCAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    // 15/09/2026
    {
      data: '2026-09-15',
      descricao: 'Débito de Cartão - REGINALDO APARECIDO LA NEVES PAULIST BRA',
      valor: 860.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MAO_OBRA_TERCEIRIZADA,
      obraId: obraNova.id,
      clienteFornecedor: 'REGINALDO APARECIDO',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-15',
      descricao: 'Débito de Cartão - COSTA RODRIGUES & CIA NEVES PAULIST BRA',
      valor: 46.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MATERIAIS,
      obraId: obraNova.id,
      clienteFornecedor: 'COSTA RODRIGUES & CIA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-15',
      descricao: 'Débito de Cartão - JM NEVENSE SUPERMERCAD NEVES PAULIST BRA',
      valor: 93.96,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'JM NEVENSE SUPERMERCAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-15',
      descricao: 'Débito de Cartão - COSTA RODRIGUES & CIA NEVES PAULIST BRA',
      valor: 517.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MATERIAIS,
      obraId: obraNova.id,
      clienteFornecedor: 'COSTA RODRIGUES & CIA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-15',
      descricao: 'Débito de Cartão - JIM.COM* 51141415 DANI NEVES PAULIST BRA',
      valor: 12.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_GERAIS_OBRA,
      obraId: obraNova.id,
      clienteFornecedor: 'JIM.COM',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    // 16/09/2026
    {
      data: '2026-09-16',
      descricao: 'Débito de Cartão - JR CUNHA E SILVA ESTE NEVES PAULIST BRA',
      valor: 100.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_VEICULOS,
      obraId: obraNova.id,
      clienteFornecedor: 'JR CUNHA E SILVA ESTE',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-16',
      descricao: 'Débito de Cartão - COSTA RODRIGUES & CIA NEVES PAULIST BRA',
      valor: 51.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MATERIAIS,
      obraId: obraNova.id,
      clienteFornecedor: 'COSTA RODRIGUES & CIA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-16',
      descricao: 'Débito de Cartão - SUPERMERCADO GIMENEZ NEVES PAULIST BRA',
      valor: 98.75,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'SUPERMERCADO GIMENEZ',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-16',
      descricao: 'Pix enviado para LUCAS BARBOSA MATERIAIS PARA CONSTRUCAO LTDA',
      valor: 5576.40,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MATERIAIS,
      obraId: obraJaqueline ? obraJaqueline.id : null,
      clienteFornecedor: 'LUCAS BARBOSA MATERIAIS PARA CONSTRUCAO LTDA',
      status: 'PAGO',
      observacao: 'Fornecedor de Materiais de Construção'
    },
    {
      data: '2026-09-16',
      descricao: 'Débito de Cartão - COSTA RODRIGUES & CIA NEVES PAULIST BRA',
      valor: 1248.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MATERIAIS,
      obraId: obraNova.id,
      clienteFornecedor: 'COSTA RODRIGUES & CIA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    // 17/09/2026
    {
      data: '2026-09-17',
      descricao: 'Débito de Cartão - J LEONEL DA SILVA PADA NEVES PAULIST BRA',
      valor: 27.95,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'J LEONEL DA SILVA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-17',
      descricao: 'Pix enviado para Luan Faria Ramos Costa - Adiantamento/Despesas',
      valor: 1000.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.FOLHA_CAMPO,
      obraId: null,
      funcionarioId: getFuncId('Luan'),
      status: 'PAGO',
      observacao: 'Adiantamento de viagem/despesas para colaborador'
    },
    {
      data: '2026-09-17',
      descricao: 'Pix enviado para José Marlon da Silva Marcelo',
      valor: 200.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MAO_OBRA_TERCEIRIZADA,
      obraId: null,
      clienteFornecedor: 'José Marlon da Silva Marcelo',
      status: 'PAGO',
      observacao: 'Prestador de serviços terceirizados'
    },
    {
      data: '2026-09-17',
      descricao: 'Débito de Cartão - JM NEVENSE SUPERMERCAD NEVES PAULIST BRA',
      valor: 98.95,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'JM NEVENSE SUPERMERCAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-17',
      descricao: 'Débito de Cartão - MP *CORUJAOLANCHES Neves Paulist BRA',
      valor: 56.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'CORUJAO LANCHES',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    // 18/09/2026
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - PELLACANI E GOMES PAD NEVES PAULIST BRA',
      valor: 13.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'PELLACANI E GOMES PAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - COSTA RODRIGUES & CIA NEVES PAULIST BRA',
      valor: 83.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MATERIAIS,
      obraId: obraNova.id,
      clienteFornecedor: 'COSTA RODRIGUES & CIA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - FARMA NOVA NEVES PAULIST BRA',
      valor: 48.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_GERAIS_OBRA,
      obraId: obraNova.id,
      clienteFornecedor: 'FARMA NOVA',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - JM NEVENSE SUPERMERCAD NEVES PAULIST BRA',
      valor: 102.56,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'JM NEVENSE SUPERMERCAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - JM NEVENSE SUPERMERCAD NEVES PAULIST BRA',
      valor: 5.49,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'JM NEVENSE SUPERMERCAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-18',
      descricao: 'Pix enviado para Luan Faria Ramos Costa - Salário',
      valor: 2600.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.FOLHA_CAMPO,
      obraId: null,
      funcionarioId: getFuncId('Luan'),
      status: 'PAGO',
      observacao: 'Pagamento Salário Colaborador'
    },
    {
      data: '2026-09-18',
      descricao: 'Pix enviado para Cauan Bruno Schiavon da Silva - Salário',
      valor: 1950.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.FOLHA_CAMPO,
      obraId: null,
      funcionarioId: getFuncId('Cauan'),
      status: 'PAGO',
      observacao: 'Pagamento Salário Colaborador'
    },
    {
      data: '2026-09-18',
      descricao: 'Pix enviado para Gabriel Pereira dos Santos - Salário',
      valor: 1950.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.FOLHA_CAMPO,
      obraId: null,
      funcionarioId: getFuncId('Gabriel'),
      status: 'PAGO',
      observacao: 'Pagamento Salário Colaborador'
    },
    {
      data: '2026-09-18',
      descricao: 'Pix enviado para RECEITA FEDERAL (Tributos/DARF)',
      valor: 178.31,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.IMPOSTOS_TAXAS,
      obraId: null,
      clienteFornecedor: 'RECEITA FEDERAL',
      status: 'PAGO',
      observacao: 'Pagamento de Tributos Federais'
    },
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - GervanCELL NEVES PAULIST BRA',
      valor: 30.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.TELEFONIA_COMUNICACAO,
      obraId: obraNova.id,
      clienteFornecedor: 'GervanCELL',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - GervanCELL NEVES PAULIST BRA',
      valor: 20.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.TELEFONIA_COMUNICACAO,
      obraId: obraNova.id,
      clienteFornecedor: 'GervanCELL',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - SUPERMERCADO STA ROSA NEVES PAULIST BRA',
      valor: 32.17,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'SUPERMERCADO STA ROSA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - SUPERMERCADO STA ROSA NEVES PAULIST BRA',
      valor: 115.27,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'SUPERMERCADO STA ROSA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-18',
      descricao: 'Débito de Cartão - AraujoTorres BARBOSA BRA',
      valor: 100.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_GERAIS_OBRA,
      obraId: obraNova.id,
      clienteFornecedor: 'AraujoTorres',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    // 19/09/2026
    {
      data: '2026-09-19',
      descricao: 'Débito de Cartão - SUPERMERCADO BOGAZ NEVES PAULIST BRA',
      valor: 8.38,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'SUPERMERCADO BOGAZ',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-19',
      descricao: 'Débito de Cartão - JM NEVENSE SUPERMERCAD NEVES PAULIST BRA',
      valor: 68.97,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'JM NEVENSE SUPERMERCAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-19',
      descricao: 'Débito de Cartão - JR CUNHA E SILVA ESTE NEVES PAULIST BRA',
      valor: 50.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_VEICULOS,
      obraId: obraNova.id,
      clienteFornecedor: 'JR CUNHA E SILVA ESTE',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-19',
      descricao: 'Débito de Cartão - LeonardoCellLtda NEVES PAULIST BRA',
      valor: 45.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.TELEFONIA_COMUNICACAO,
      obraId: obraNova.id,
      clienteFornecedor: 'LeonardoCellLtda',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    {
      data: '2026-09-19',
      descricao: 'Débito de Cartão - J LEONEL DA SILVA PADA NEVES PAULIST BRA',
      valor: 8.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'J LEONEL DA SILVA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-19',
      descricao: 'Débito de Cartão - SUPERMERCADO STA ROSA NEVES PAULIST BRA',
      valor: 424.13,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'SUPERMERCADO STA ROSA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    // 20/09/2026
    {
      data: '2026-09-20',
      descricao: 'Débito de Cartão - SUPERMERCADO BOGAZ NEVES PAULIST BRA',
      valor: 46.29,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'SUPERMERCADO BOGAZ',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-20',
      descricao: 'Débito de Cartão - IreneAparecida NEVES PAULIST BRA',
      valor: 91.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'IreneAparecida',
      status: 'A_CONFIRMAR',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA - A CONFIRMAR'
    },
    // 21/09/2026
    {
      data: '2026-09-21',
      descricao: 'Débito de Cartão - COSTA RODRIGUES & CIA NEVES PAULIST BRA',
      valor: 165.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MATERIAIS,
      obraId: obraNova.id,
      clienteFornecedor: 'COSTA RODRIGUES & CIA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-21',
      descricao: 'Débito de Cartão - JM NEVENSE SUPERMERCAD NEVES PAULIST BRA',
      valor: 86.87,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'JM NEVENSE SUPERMERCAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-21',
      descricao: 'Débito de Cartão - EMPORIO SAO LUIS GAS E NEVES PAULIST BRA',
      valor: 19.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_GERAIS_OBRA,
      obraId: obraNova.id,
      clienteFornecedor: 'EMPORIO SAO LUIS GAS',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-21',
      descricao: 'Débito de Cartão - SUPERMERCADO BOGAZ NEVES PAULIST BRA',
      valor: 66.54,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'SUPERMERCADO BOGAZ',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-21',
      descricao: 'Débito de Cartão - CONVENIENCIA NEVES PAULIST BRA',
      valor: 27.50,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'CONVENIENCIA NEVES PAULIST',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    // 22/09/2026
    {
      data: '2026-09-22',
      descricao: 'Débito de Cartão - COSTA RODRIGUES & CIA NEVES PAULIST BRA',
      valor: 242.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.MATERIAIS,
      obraId: obraNova.id,
      clienteFornecedor: 'COSTA RODRIGUES & CIA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-22',
      descricao: 'Débito de Cartão - JR CUNHA E SILVA ESTE NEVES PAULIST BRA',
      valor: 100.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.DESPESAS_VEICULOS,
      obraId: obraNova.id,
      clienteFornecedor: 'JR CUNHA E SILVA ESTE',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    // 23/09/2026
    {
      data: '2026-09-23',
      descricao: 'Débito de Cartão - JM NEVENSE SUPERMERCAD NEVES PAULIST BRA',
      valor: 109.85,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'JM NEVENSE SUPERMERCAD',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-23',
      descricao: 'Débito de Cartão - CONVENIENCIA NEVES PAULIST BRA',
      valor: 22.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'CONVENIENCIA NEVES PAULIST',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
    {
      data: '2026-09-23',
      descricao: 'Pix enviado para PATRICIA GRUBEL DA ROCHA - Pró-Labore/Salário',
      valor: 1000.00,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.PRO_LABORE_ADM,
      obraId: null,
      funcionarioId: getFuncId('Patrícia'),
      status: 'PAGO',
      observacao: 'Pagamento equipe administrativa'
    },
    {
      data: '2026-09-23',
      descricao: 'Débito de Cartão - SUPERMERCADO STA ROSA NEVES PAULIST BRA',
      valor: 172.81,
      tipo: 'DESPESA',
      categoriaId: CAT_IDS.ALIMENTACAO_HOSPEDAGEM,
      obraId: obraNova.id,
      clienteFornecedor: 'SUPERMERCADO STA ROSA',
      status: 'PAGO',
      observacao: 'Lançamento de cartão de débito vinculado à Obra NOVA'
    },
  ];

  let inseridas = 0;
  for (const n of novasTransacoes) {
    const dataVenc = new Date(`${n.data}T12:00:00.000Z`);
    
    // Verificar se já existe transação exatamente igual (mesmo valor, mesma data e mesma conta)
    const inicioDia = new Date(`${n.data}T00:00:00.000Z`);
    const fimDia = new Date(`${n.data}T23:59:59.999Z`);
    
    const existe = await prisma.transacaoFinanceira.findFirst({
      where: {
        tenantId: TENANT_ID,
        contaBancariaId: c6.id,
        valor: n.valor,
        tipo: n.tipo,
        dataVencimento: {
          gte: inicioDia,
          lte: fimDia
        }
      }
    });

    if (existe) {
      console.log(`- Já existe transação R$ ${n.valor} em ${n.data}: ${existe.descricao} (ID: ${existe.id})`);
      continue;
    }

    await prisma.transacaoFinanceira.create({
      data: {
        descricao: n.descricao,
        valor: n.valor,
        tipo: n.tipo,
        status: n.status,
        categoriaId: n.categoriaId,
        obraId: n.obraId,
        contaBancariaId: c6.id,
        funcionarioId: n.funcionarioId || null,
        clienteFornecedor: n.clienteFornecedor || null,
        dataVencimento: dataVenc,
        dataPagamento: dataVenc,
        observacao: n.observacao || null,
        statusAprovacao: 'APROVADO',
        tenantId: TENANT_ID
      }
    });
    inseridas++;
    console.log(`+ Inserida [${n.status}]: ${n.data} | R$ ${n.valor.toFixed(2)} | ${n.descricao}`);
  }

  console.log(`\nInserção concluída: ${inseridas} transações registradas.`);

  // 4. Verificação de Saldo C6
  const txsC6 = await prisma.transacaoFinanceira.findMany({
    where: { contaBancariaId: c6.id, tenantId: TENANT_ID }
  });

  let totalRec = 0;
  let totalDesp = 0;
  for (const t of txsC6) {
    if (t.tipo === 'RECEITA') totalRec += Number(t.valor);
    else totalDesp += Number(t.valor);
  }

  const saldoFinal = totalRec - totalDesp;
  console.log('----------------------------------------------------');
  console.log(`Total Receitas C6: R$ ${totalRec.toFixed(2)}`);
  console.log(`Total Despesas C6: R$ ${totalDesp.toFixed(2)}`);
  console.log(`Saldo Calculado C6: R$ ${saldoFinal.toFixed(2)}`);
  console.log(`Saldo Extrato C6:   R$ 75517.71`);
  console.log(`Diferença: R$ ${(saldoFinal - 75517.71).toFixed(2)}`);
  console.log('----------------------------------------------------');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
