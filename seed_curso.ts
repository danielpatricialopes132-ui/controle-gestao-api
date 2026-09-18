import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Criar Tenant TESTE S/A
  const tenant = await prisma.tenant.upsert({
    where: { nome: 'TESTE S/A - Ambiente de Curso' },
    update: {},
    create: {
      nome: 'TESTE S/A - Ambiente de Curso',
      documento: '00.000.000/0000-00',
    },
  });

  // 2. Criar Usuário do Curso
  const hashedPassword = await bcrypt.hash('@Maraca!132', 10);
  const user = await prisma.usuario.upsert({
    where: { email: 'aluno@testesa.com.br' },
    update: {
      password: hashedPassword,
      status: 'ATIVO',
      tenantId: tenant.id
    },
    create: {
      nome: 'Aluno Treinamento',
      email: 'aluno@testesa.com.br',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ATIVO',
      tenantId: tenant.id
    },
  });

  console.log('Ambiente de Curso Criado:');
  console.log(`Empresa: ${tenant.nome}`);
  console.log(`Email: ${user.email}`);
  console.log(`Senha: @Maraca!132`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
