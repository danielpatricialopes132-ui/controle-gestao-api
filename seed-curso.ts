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

  // 1. Criar ou Atualizar Tenant do Curso
  const tenant = await prisma.tenant.upsert({
    where: { documento: '00.000.000/0000-00' },
    update: {
      nome: 'TESTE S/A - Ambiente de Curso',
      corPrimaria: '#1E3A8A',
    },
    create: {
      nome: 'TESTE S/A - Ambiente de Curso',
      documento: '00.000.000/0000-00',
      corPrimaria: '#1E3A8A',
    },
  });

  console.log('Tenant Created/Found:', tenant.id);

  // 2. Criar Categorias Financeiras Padrão
  const categoriasPadrao = [
    { nome: 'Alvenaria e Estrutura', tipo: 'DESPESA' },
    { nome: 'Instalações Hidráulicas e Elétricas', tipo: 'DESPESA' },
    { nome: 'Empreiteiros e Terceirizados', tipo: 'DESPESA' },
    { nome: 'Medições de Obras', tipo: 'DESPESA' },
    { nome: 'Compras de Insumos', tipo: 'DESPESA' },
    { nome: 'Recebimento de Clientes / Medição', tipo: 'RECEITA' },
  ];

  for (const cat of categoriasPadrao) {
    const existe = await prisma.categoriaFinanceira.findFirst({
      where: { tenantId: tenant.id, nome: cat.nome },
    });
    if (!existe) {
      await prisma.categoriaFinanceira.create({
        data: {
          tenantId: tenant.id,
          nome: cat.nome,
          tipo: cat.tipo,
        },
      });
    }
  }

  // 3. Criar Usuário Aluno
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

  // 4. Criar Obra Modelo do Treinamento
  const obra = await prisma.obra.create({
    data: {
      tenantId: tenant.id,
      nome: 'Residencial Bela Vista - Torre Alpha',
      endereco: 'Av. Paulista, 1000 - São Paulo/SP',
      status: 'EM_ANDAMENTO',
      orcamentoTotal: 2500000.0,
      dataInicio: new Date('2026-01-10'),
      dataPrevisaoFim: new Date('2026-12-20'),
    }
  });

  // 5. Cadastrar Fornecedores: Materiais, Empreiteiro Principal e Subcontratado
  const fornMaterial = await prisma.fornecedor.create({
    data: {
      tenantId: tenant.id,
      nome: 'Votorantim Cimentos S/A',
      nomeRazao: 'Votorantim Cimentos Brasil S/A',
      cnpj: '01.838.723/0001-27',
      tipoFornecedor: 'MATERIAL',
      telefone: '(11) 3003-7000',
    }
  });

  const empPrincipal = await prisma.fornecedor.create({
    data: {
      tenantId: tenant.id,
      nome: 'Alfa Estruturas & Edificações Ltda',
      nomeRazao: 'Alfa Estruturas & Edificações Ltda - ME',
      cnpj: '12.345.678/0001-90',
      tipoFornecedor: 'EMPREITEIRO',
      telefone: '(11) 98765-4321',
      chavePix: '12345678000190',
      banco: 'Banco do Brasil',
      agencia: '1234',
      conta: '56789-0',
    }
  });

  const subcontratado = await prisma.fornecedor.create({
    data: {
      tenantId: tenant.id,
      nome: 'Beta Instalações Hidráulicas Eireli',
      nomeRazao: 'Beta Instalações Hidráulicas & Gás Eireli',
      cnpj: '98.765.432/0001-10',
      tipoFornecedor: 'SUBCONTRATADO',
      empreiteiroPaiId: empPrincipal.id,
      telefone: '(11) 91234-5678',
      chavePix: 'contato@betahidraulica.com.br',
    }
  });

  // 6. Cadastrar Funcionários no RH: Próprio, do Empreiteiro Principal e do Subcontratado
  await prisma.funcionario.create({
    data: {
      tenantId: tenant.id,
      nome: 'Marcos Vinicius (Encarregado Construtora)',
      cargo: 'Mestre Geral de Obras',
      tipoColaborador: 'PROPRIO',
      salario: 6500.0,
      tipoPagamento: 'MENSALISTA',
    }
  });

  const funcEmp = await prisma.funcionario.create({
    data: {
      tenantId: tenant.id,
      nome: 'Carlos Eduardo Silva',
      cargo: 'Armador Líder',
      tipoColaborador: 'TERCEIRIZADO',
      fornecedorId: empPrincipal.id,
      valorDiaria: 220.0,
      tipoPagamento: 'DIARISTA',
    }
  });

  const funcSub = await prisma.funcionario.create({
    data: {
      tenantId: tenant.id,
      nome: 'Rodrigo dos Santos',
      cargo: 'Encanador Industrial',
      tipoColaborador: 'TERCEIRIZADO',
      fornecedorId: subcontratado.id,
      valorDiaria: 200.0,
      tipoPagamento: 'DIARISTA',
    }
  });

  // 7. Lançar Presença Diária Demonstrando a Rastreabilidade no Canteiro
  const dataHoje = new Date();
  dataHoje.setHours(0, 0, 0, 0);

  await prisma.registroPresenca.createMany({
    data: [
      {
        tenantId: tenant.id,
        obraId: obra.id,
        funcionarioId: funcEmp.id,
        data: dataHoje,
        status: 'TRABALHO',
        horasTrabalhadas: 8,
        statusAprovacao: 'APROVADO',
        observacao: 'Armação dos pilares do 3º pavimento',
      },
      {
        tenantId: tenant.id,
        obraId: obra.id,
        funcionarioId: funcSub.id,
        data: dataHoje,
        status: 'TRABALHO',
        horasTrabalhadas: 8,
        statusAprovacao: 'APROVADO',
        observacao: 'Prumadas de água fria e esgoto',
      }
    ]
  });

  // 8. Criar Contrato de Empreiteiro com Aditivo e Medição com Dedução de Subcontratado
  const contrato = await prisma.contratoEmpreiteiro.create({
    data: {
      tenantId: tenant.id,
      fornecedorId: empPrincipal.id,
      obraId: obra.id,
      numeroContrato: 'CT-001/2026',
      objeto: 'Execução de estrutura de concreto armado e alvenaria de vedação',
      valorOriginal: 120000.0,
      dataInicio: new Date('2026-02-01'),
      dataPrevisaoTermino: new Date('2026-07-30'),
      status: 'ATIVO',
      retencaoInss: 11.0,
      retencaoIss: 5.0,
      retencaoIrrf: 1.5,
    }
  });

  // Adendo de R$ 15.000,00 por aumento de área técnica
  await prisma.adendoContratoEmpreiteiro.create({
    data: {
      contratoId: contrato.id,
      numeroAdendo: 'Termo Aditivo 01',
      tipoAdendo: 'VALOR',
      descricao: 'Acréscimo de laje de reservatório superior e barrilete',
      valorAcrescimo: 15000.0,
      dataAdendo: new Date('2026-03-01'),
    }
  });

  // Medição 01 com dedução legal da nota do subcontratado (Art. 31 Lei 8.212/91)
  const valorBrutoMedicao = 40000.0;
  const deducaoSub = 10000.0; // R$ 10.000 da subcontratada Beta Hidráulica
  const baseInss = valorBrutoMedicao - deducaoSub; // R$ 30.000
  const inssCalculado = baseInss * 0.11; // R$ 3.300 (sem dedução seria R$ 4.400 -> economia de R$ 1.100 p/ bitributação)
  const issCalculado = valorBrutoMedicao * 0.05; // R$ 2.000
  const irrfCalculado = valorBrutoMedicao * 0.015; // R$ 600
  const totalRetencoes = inssCalculado + issCalculado + irrfCalculado; // R$ 5.900
  const valorLiquido = valorBrutoMedicao - totalRetencoes; // R$ 34.100

  const medicao = await prisma.medicaoEmpreiteiro.create({
    data: {
      contratoId: contrato.id,
      numeroMedicao: 1,
      dataMedicao: new Date('2026-03-15'),
      periodoInicio: new Date('2026-02-01'),
      periodoFim: new Date('2026-02-28'),
      valorBruto: valorBrutoMedicao,
      valorDeducaoSubcontratados: deducaoSub,
      valorDeducaoAdiantamento: 0.0,
      valorInss: inssCalculado,
      valorIss: issCalculado,
      valorIrrf: irrfCalculado,
      valorLiquido: valorLiquido,
      status: 'APROVADA',
      observacoes: 'Medição da laje do 2º pavimento com dedução da NF 450 do subcontratado Beta Hidráulica',
    }
  });

  // Provisionar a despesa líquida no contas a pagar
  await prisma.transacaoFinanceira.create({
    data: {
      tenantId: tenant.id,
      obraId: obra.id,
      descricao: `Pagamento Medição #1 - Contrato ${contrato.numeroContrato} - Alfa Estruturas`,
      valor: valorLiquido,
      tipo: 'DESPESA',
      status: 'PENDENTE',
      categoria: 'Empreiteiros e Terceirizados',
      dataVencimento: new Date('2026-03-30'),
      dataCompetencia: new Date('2026-03-15'),
      medicaoEmpreiteiroId: medicao.id,
    }
  });

  // 9. Histórico de Insumos com Variação de Preços (Inteligência de Preços)
  const produtoCimento = await prisma.produto.create({
    data: {
      tenantId: tenant.id,
      nome: 'Cimento CP II-E-32 50kg',
      unidadeMedida: 'Saco',
      custoUltimaCompra: 34.50,
    }
  });

  // Compra anterior mais barata (R$ 32,00)
  const oc1 = await prisma.ordemCompra.create({
    data: {
      tenantId: tenant.id,
      fornecedorId: fornMaterial.id,
      obraId: obra.id,
      numero: 'OC-2026-001',
      valorTotal: 1600.0,
      status: 'ENTREGUE',
      dataEntrega: new Date('2026-02-10'),
      itens: {
        create: [
          {
            tenantId: tenant.id,
            produtoId: produtoCimento.id,
            quantidade: 50,
            precoUnitario: 32.0,
          }
        ]
      }
    }
  });

  // Compra recente a R$ 34,50
  const oc2 = await prisma.ordemCompra.create({
    data: {
      tenantId: tenant.id,
      fornecedorId: fornMaterial.id,
      obraId: obra.id,
      numero: 'OC-2026-002',
      valorTotal: 3450.0,
      status: 'ENTREGUE',
      dataEntrega: new Date('2026-03-05'),
      itens: {
        create: [
          {
            tenantId: tenant.id,
            produtoId: produtoCimento.id,
            quantidade: 100,
            precoUnitario: 34.50,
          }
        ]
      }
    }
  });

  console.log('--- SEED DO CURSO CONCLUÍDO COM SUCESSO ---');
  console.log(`Empresa de Treinamento: ${tenant.nome}`);
  console.log(`Obra Criada: ${obra.nome}`);
  console.log(`Empreiteiro Principal: ${empPrincipal.nome}`);
  console.log(`Subcontratado: ${subcontratado.nome}`);
  console.log(`Contrato: ${contrato.numeroContrato} (Valor Atualizado: R$ 135.000,00)`);
  console.log(`Medição #1: R$ ${valorBrutoMedicao} Bruto | R$ ${valorLiquido} Líquido (Dedução Sub: R$ ${deducaoSub})`);
  console.log(`Credenciais de Acesso:`);
  console.log(`E-mail: ${user.email}`);
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
