import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const resolvedParams = await params;
    const { token } = resolvedParams;

    if (!token) {
      return NextResponse.json({ error: 'Token ou identificador inválido' }, { status: 400 });
    }

    // Busca os dados da empresa terceira vinculada à obra
    const terceiro = await prisma.terceiroCliente.findUnique({
      where: { id: token },
      include: {
        obra: {
          select: {
            id: true,
            nome: true,
            endereco: true,
            status: true,
            tenantId: true,
          },
        },
        tenant: {
          select: {
            id: true,
            nome: true,
            logoUrl: true,
            telefone: true,
          },
        },
        autorizacoesPortaria: {
          orderBy: { createdAt: 'desc' },
        },
        punchList: {
          orderBy: { createdAt: 'desc' },
        },
        termosRetirada: {
          orderBy: { createdAt: 'desc' },
        },
        visitas: {
          orderBy: { dataVisita: 'desc' },
          take: 10,
        },
      },
    });

    if (!terceiro) {
      return NextResponse.json({ error: 'Empresa terceira não localizada ou acesso expirado' }, { status: 404 });
    }

    return NextResponse.json({
      terceiro: {
        id: terceiro.id,
        nomeEmpresa: terceiro.nomeEmpresa,
        especialidade: terceiro.especialidade,
        responsavel: terceiro.responsavel,
        telefone: terceiro.telefone,
        email: terceiro.email,
        status: terceiro.status,
        dataPrevisaoInicio: terceiro.dataPrevisaoInicio,
        dataPrevisaoFim: terceiro.dataPrevisaoFim,
        observacoes: terceiro.observacoes,
      },
      obra: terceiro.obra,
      empresa: {
        nome: terceiro.tenant.nome,
        logoUrl: terceiro.tenant.logoUrl,
        telefone: terceiro.tenant.telefone,
      },
      autorizacoesPortaria: terceiro.autorizacoesPortaria,
      punchList: terceiro.punchList,
      termosRetirada: terceiro.termosRetirada,
      visitas: terceiro.visitas,
    });
  } catch (error: any) {
    console.error('Erro ao buscar portal do terceiro:', error);
    return NextResponse.json({ error: 'Erro interno ao consultar dados do terceiro' }, { status: 500 });
  }
}
