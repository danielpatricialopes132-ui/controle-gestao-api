import { PrismaClient } from '@prisma/client';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import dotenv from 'dotenv';

dotenv.config();

// Inicializar Firebase Admin (necessário para pegar/criar o UID do MASTER)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const prisma = new PrismaClient();
const auth = getAuth();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // 1. Criar ou buscar a empresa TESTE LTDA
  const testeTenant = await prisma.tenant.upsert({
    where: { documento: '00000000000000' }, // Usando um documento fictício para garantir unicidade
    update: {},
    create: {
      nome: 'TESTE LTDA',
      documento: '00000000000000',
    },
  });

  console.log(`Empresa TESTE LTDA garantida. ID: ${testeTenant.id}`);

  // 2. Garantir que os usuários do Firebase existam e criar como MASTER
  const masterEmail = 'danielsmlopes@hotmail.com';
  let masterUid;

  try {
    const userRecord = await auth.getUserByEmail(masterEmail);
    masterUid = userRecord.uid;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      const userRecord = await auth.createUser({
        email: masterEmail,
        password: 'Password123!', // Senha inicial se precisar criar
      });
      masterUid = userRecord.uid;
      console.log(`Usuário Firebase MASTER criado com UID: ${masterUid}`);
    } else {
      throw error;
    }
  }

  // 3. Criar ou atualizar o usuário MASTER no banco
  const masterUser = await prisma.usuario.upsert({
    where: { firebaseUid: masterUid },
    update: {
      role: 'MASTER',
      status: 'ATIVO',
      tenantId: testeTenant.id, // Vinculado a TESTE LTDA (poderia ver todas, mas a lógica vai ser ver a selecionada)
    },
    create: {
      firebaseUid: masterUid,
      email: masterEmail,
      nome: 'Daniel Lopes (Master)',
      role: 'MASTER',
      status: 'ATIVO',
      tenantId: testeTenant.id,
    },
  });

  console.log(`Usuário MASTER garantido no banco. ID: ${masterUser.id}`);
  // Criar uma Obra de teste
  const obra = await prisma.obra.create({
    data: {
      nome: 'Residencial Leopoldo 2',
      tenantId: testeTenant.id,
      status: 'EM_ANDAMENTO',
    }
  });

  // Criar Contrato para a Obra
  await prisma.contrato.create({
    data: {
      descricao: 'Contrato Principal - Leopoldo 2',
      valor: 500000.00,
      obraId: obra.id,
      tenantId: testeTenant.id,
    }
  });

  // Criar Transações Financeiras (Receitas e Despesas)
  const hoje = new Date();
  
  // Receita há 1 mês (para gerar saldo inicial)
  const mesPassado = new Date(hoje);
  mesPassado.setMonth(mesPassado.getMonth() - 1);
  await prisma.transacaoFinanceira.create({
    data: {
      tipo: 'RECEITA',
      categoria: 'CONTRATO_PRINCIPAL',
      descricao: 'Sinal Leopoldo 2',
      valor: 150000.00,
      dataVencimento: mesPassado,
      dataPagamento: mesPassado,
      status: 'PAGO',
      obraId: obra.id,
      tenantId: testeTenant.id,
    }
  });

  // Despesa há 2 semanas (para gerar saldo inicial)
  const semanas2 = new Date(hoje);
  semanas2.setDate(semanas2.getDate() - 14);
  await prisma.transacaoFinanceira.create({
    data: {
      tipo: 'DESPESA',
      categoria: 'MATERIAL',
      descricao: 'Compra de Cimento e Areia',
      valor: 15000.00,
      dataVencimento: semanas2,
      dataPagamento: semanas2,
      status: 'PAGO',
      obraId: obra.id,
      tenantId: testeTenant.id,
    }
  });

  // Receita nesta semana
  const semana1 = new Date(hoje);
  semana1.setDate(semana1.getDate() - 2);
  await prisma.transacaoFinanceira.create({
    data: {
      tipo: 'RECEITA',
      categoria: 'CONTRATO_PRINCIPAL',
      descricao: 'Parcela 02 Leopoldo 2',
      valor: 50000.00,
      dataVencimento: semana1,
      dataPagamento: semana1,
      status: 'PAGO',
      obraId: obra.id,
      tenantId: testeTenant.id,
    }
  });

  // Despesa nesta semana
  const semana1_2 = new Date(hoje);
  semana1_2.setDate(semana1_2.getDate() - 1);
  await prisma.transacaoFinanceira.create({
    data: {
      tipo: 'DESPESA',
      categoria: 'PESSOAL',
      descricao: 'Folha de Pagamento - Empreiteiro',
      valor: 8000.00,
      dataVencimento: semana1_2,
      dataPagamento: semana1_2,
      status: 'PAGO',
      obraId: obra.id,
      tenantId: testeTenant.id,
    }
  });

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
