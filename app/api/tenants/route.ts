import { NextResponse } from 'next/server';
import { verifyIdToken, registrarLog } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);

    if (userAuth.role !== 'MASTER' && userAuth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Acesso restrito a Administradores.' }, { status: 403 });
    }

    // Se for MASTER lista todos, se for ADMIN lista apenas o seu próprio
    const where = userAuth.role === 'MASTER' ? {} : { id: userAuth.tenantId };

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        _count: {
          select: {
            usuarios: true,
            obras: true,
            categoriasFinanceiras: true,
          }
        }
      },
      orderBy: { nome: 'asc' }
    });

    return NextResponse.json({ success: true, data: tenants });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);

    if (userAuth.role !== 'MASTER') {
      return NextResponse.json({ success: false, error: 'Restrito a SUPER ADMINS (MASTER).' }, { status: 403 });
    }

    const body = await request.json();
    
    if (!body.nome || !body.documento) {
      return NextResponse.json({ success: false, error: 'Nome e Documento são obrigatórios' }, { status: 400 });
    }

    const tenant = await prisma.tenant.create({
      data: {
        nome: body.nome,
        documento: body.documento,
        logoUrl: body.logoUrl || null,
        corPrimaria: body.corPrimaria || '#3F51B5',
      }
    });

    // Criar o Plano de Contas / Categorias Financeiras padrão para essa nova empresa
    const categoriasPadrao = [
      // Despesas Operacionais / Obras
      { codigo: '01.01', descricao: 'Materiais Básicos (Cimento, Areia, Aço, Blocos)', tipo: 'DESPESA' },
      { codigo: '01.02', descricao: 'Acabamentos, Pisos e Revestimentos', tipo: 'DESPESA' },
      { codigo: '01.03', descricao: 'Instalações Hidráulicas e Elétricas', tipo: 'DESPESA' },
      { codigo: '01.04', descricao: 'Mão de Obra e Empreiteiros', tipo: 'DESPESA' },
      { codigo: '01.05', descricao: 'Locação de Máquinas e Equipamentos', tipo: 'DESPESA' },
      // Despesas Administrativas / Gerais
      { codigo: '02.01', descricao: 'Administração Geral e Escritório', tipo: 'DESPESA' },
      { codigo: '02.02', descricao: 'Combustível, Frota e Fretes', tipo: 'DESPESA' },
      { codigo: '02.03', descricao: 'Impostos, Taxas e Licenças', tipo: 'DESPESA' },
      // Receitas
      { codigo: '03.01', descricao: 'Receitas de Medições e Contratos', tipo: 'RECEITA' },
      { codigo: '03.02', descricao: 'Aditivos e Serviços Extras', tipo: 'RECEITA' },
      { codigo: '03.03', descricao: 'Outras Receitas Operacionais', tipo: 'RECEITA' },
    ];

    await prisma.categoriaFinanceira.createMany({
      data: categoriasPadrao.map(cat => ({
        codigo: cat.codigo,
        descricao: cat.descricao,
        tipo: cat.tipo,
        tenantId: tenant.id,
      })),
      skipDuplicates: true,
    });

    await registrarLog(userAuth.dbId, tenant.id, 'CRIAR_TENANT', 'SISTEMA', {
      tenantId: tenant.id,
      nome: tenant.nome,
      documento: tenant.documento,
      categoriasCriadas: categoriasPadrao.length,
    });

    return NextResponse.json({ success: true, data: tenant });
  } catch (error: any) {
    console.error('Erro em POST /api/tenants:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}


