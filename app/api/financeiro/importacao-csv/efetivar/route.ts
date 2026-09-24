import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { rows } = await request.json();
    
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Nenhuma transação enviada para efetivação' }, { status: 400 });
    }

    let insertedCount = 0;
    
    // Process everything in a transaction to ensure integrity, or individually to avoid full failure.
    // Given the nature of CSV import, processing sequentially or with Prisma transaction is preferred.
    // Let's do it sequentially to handle new Contacts properly.

    const createdObras: Record<string, string> = {}; // cache for new obras

    for (const row of rows) {
      if (row.validationStatus === 'ERRO') continue;

      let clienteFornecedor = row.clienteFornecedor;
      let rowObraId = row.obraId;

      // Handle new Obra creation
      if (row.isNovaObra && row.centroCustoStr && !rowObraId) {
        const obraName = row.centroCustoStr.trim();
        const endereco = row.novaObraData?.endereco || null;
        
        if (createdObras[obraName]) {
          rowObraId = createdObras[obraName];
        } else {
          // Check again in DB just in case
          let existingObra = await prisma.obra.findFirst({
            where: { tenantId: userAuth.tenantId, nome: obraName }
          });
          if (!existingObra) {
            existingObra = await prisma.obra.create({
              data: {
                nome: obraName,
                tenantId: userAuth.tenantId,
                status: 'EM_ANDAMENTO',
                endereco: endereco
              }
            });
          }
          createdObras[obraName] = existingObra.id;
          rowObraId = existingObra.id;
        }
      }

      // Handle new contact creation
      if (row.isNovoContato && row.clienteFornecedor) {
        // Decide whether to create as Fornecedor or Cliente based on 'tipo'
        // But for generic purposes, maybe we create it in the main tables or just store the name in 'clienteFornecedor' string field of TransacaoFinanceira.
        // TransacaoFinanceira has 'clienteFornecedor' string field natively for unstructured contacts.
        // Let's just save the string. If the user wants a real entity, they should create it beforehand or we create a Contato.
        
        // As per schema, TransacaoFinanceira has:
        // clienteFornecedor String?
        // Let's just save the string, avoiding cluttering Fornecedor/Cliente tables automatically unless explicitly instructed.
      }

      await prisma.transacaoFinanceira.create({
        data: {
          tenantId: userAuth.tenantId,
          tipo: row.tipo,
          valor: row.valor,
          descricao: row.descricao,
          dataVencimento: row.vencimento ? new Date(row.vencimento) : null,
          dataPagamento: row.dataPagamento ? new Date(row.dataPagamento) : null,
          status: row.status,
          categoriaId: row.categoriaId || null,
          contaBancariaId: row.contaBancariaId || null,
          obraId: rowObraId || null,
          clienteFornecedor: clienteFornecedor || null,
        }
      });
      insertedCount++;
    }

    return NextResponse.json({ 
      success: true,
      message: `${insertedCount} transações importadas com sucesso.`,
      count: insertedCount
    });

  } catch (error: any) {
    console.error('Erro ao efetivar CSV:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
