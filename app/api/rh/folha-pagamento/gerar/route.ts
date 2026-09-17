import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    
    if (userAuth.role !== 'MASTER' && userAuth.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Restrito a administradores.' }, { status: 403 });
    }

    const { items, descricaoMensagem } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'Lista de itens inválida.' }, { status: 400 });
    }

    const tenantId = userAuth.tenantId;

    // Achar categoria Pessoal (ou criar)
    let categoria = await prisma.categoriaFinanceira.findFirst({
      where: { tenantId, tipo: 'DESPESA', descricao: { contains: 'Pessoal' } }
    });

    if (!categoria) {
      categoria = await prisma.categoriaFinanceira.create({
        data: {
          tenantId,
          codigo: '2.1.0',
          descricao: 'Despesas com Pessoal / Folha',
          tipo: 'DESPESA'
        }
      });
    }

    // Achar a primeira obra do tenant só para vincular (já que o sistema exige obraId na transacao por enquanto)
    // O ideal seria que TransacaoFinanceira não exigisse obraId para custos fixos da empresa, 
    // mas de acordo com o schema atual, obraId é obrigatório.
    const obra = await prisma.obra.findFirst({ where: { tenantId } });
    if (!obra) {
      return NextResponse.json({ success: false, error: 'Nenhuma obra cadastrada para vincular a despesa.' }, { status: 400 });
    }

    let criados = 0;

    for (const item of items) {
      if (item.financeiro.valorAjustado > 0) {
        await prisma.transacaoFinanceira.create({
          data: {
            tenantId,
            tipo: 'DESPESA',
            categoriaId: categoria.id,
            categoria: 'PESSOAL',
            descricao: descricaoMensagem ? `${descricaoMensagem} - ${item.funcionario.nome}` : `Folha de Pagto - ${item.funcionario.nome}`,
            valor: item.financeiro.valorAjustado,
            status: 'PENDENTE',
            obraId: obra.id,
            funcionarioId: item.funcionario.id,
            dataVencimento: new Date(),
          }
        });
        criados++;
      }
    }

    return NextResponse.json({ success: true, message: `${criados} pagamentos gerados com sucesso.` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
