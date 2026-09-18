import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = getAuth();
const prisma = new PrismaClient();

async function main() {
  const email = 'aluno@testesa.com.br';
  const password = '@Maraca!132';

  let firebaseUid = '';

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: 'Aluno Treinamento'
    });
    firebaseUid = userRecord.uid;
    console.log('Firebase User Created:', firebaseUid);
  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(email);
      await auth.updateUser(existing.uid, { password, displayName: 'Aluno Treinamento' });
      firebaseUid = existing.uid;
      console.log('Firebase User Updated:', firebaseUid);
    } else {
      throw error;
    }
  }

  // Criar Tenant
  const tenant = await prisma.tenant.upsert({
    where: { documento: '00.000.000/0000-00' },
    update: {},
    create: {
      nome: 'TESTE S/A - Ambiente de Curso',
      documento: '00.000.000/0000-00',
    },
  });

  console.log('Tenant Created/Found:', tenant.id);

  // Criar Usuário no Prisma
  const user = await prisma.usuario.upsert({
    where: { firebaseUid },
    update: {
      email,
      nome: 'Aluno Treinamento',
      role: 'ADMIN',
      status: 'ATIVO',
      tenantId: tenant.id
    },
    create: {
      email,
      nome: 'Aluno Treinamento',
      role: 'ADMIN',
      status: 'ATIVO',
      tenantId: tenant.id,
      firebaseUid
    },
  });

  console.log('Ambiente de Curso Criado com Sucesso!');
  console.log(`Empresa: ${tenant.nome}`);
  console.log(`Email: ${user.email}`);
  console.log(`Senha: ${password}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
