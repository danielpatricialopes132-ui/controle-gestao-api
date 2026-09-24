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
      return NextResponse.json({ error: 'Nenhuma obra enviada para efetivação' }, { status: 400 });
    }

    let insertedCount = 0;
    
    // We cache created entities to avoid duplicates within the same import payload
    const createdClientes: Record<string, string> = {}; 
    const createdObras: Record<string, string> = {};

    for (const row of rows) {
      // Ignore if marked as skipped by user or if it has an error
      if (row.skip || row.validationStatus === 'ERRO') continue;

      let clienteId = row.clienteId;
      let obraId = row.obraId;

      // Handle Client creation
      if (row.isNovoCliente && row.clienteNome && !clienteId) {
        const cNome = row.clienteNome.trim();
        if (createdClientes[cNome]) {
          clienteId = createdClientes[cNome];
        } else {
          // Double check DB
          let existingC = await prisma.cliente.findFirst({
            where: { tenantId: userAuth.tenantId, nome: cNome }
          });
          if (!existingC) {
            existingC = await prisma.cliente.create({
              data: {
                nome: cNome,
                tenantId: userAuth.tenantId,
              }
            });
          }
          createdClientes[cNome] = existingC.id;
          clienteId = existingC.id;
        }
      }

      // Handle Obra creation
      if (row.isNovaObra && row.nomeObra && !obraId) {
        const oNome = row.nomeObra.trim();
        if (createdObras[oNome]) {
          obraId = createdObras[oNome];
        } else {
          let existingO = await prisma.obra.findFirst({
            where: { tenantId: userAuth.tenantId, nome: oNome }
          });
          if (!existingO) {
            existingO = await prisma.obra.create({
              data: {
                nome: oNome,
                tenantId: userAuth.tenantId,
                status: row.status || 'EM_ANDAMENTO',
                endereco: row.endereco || null,
                clienteId: clienteId || null,
              }
            });
          } else {
             // If obra existed but was flagged as new incorrectly, just update the clienteId and endereco if they were missing
             await prisma.obra.update({
               where: { id: existingO.id },
               data: {
                 clienteId: existingO.clienteId || clienteId || null,
                 endereco: existingO.endereco || row.endereco || null,
               }
             });
          }
          createdObras[oNome] = existingO.id;
          obraId = existingO.id;
        }
      } else if (obraId && clienteId) {
         // Update existing obra to link with this client if needed
         await prisma.obra.update({
           where: { id: obraId },
           data: { clienteId }
         });
      }

      if (obraId) {
        // Handle Contrato (Valor Fechado)
        let contrato = await prisma.contrato.findUnique({ where: { obraId } });
        if (!contrato && row.valorFechado > 0) {
          contrato = await prisma.contrato.create({
             data: {
               descricao: `Contrato - ${row.nomeObra}`,
               valor: row.valorFechado,
               obraId: obraId,
               tenantId: userAuth.tenantId,
             }
          });
        } else if (contrato && row.valorFechado > 0) {
           // Optionally update
           await prisma.contrato.update({
             where: { id: contrato.id },
             data: { valor: row.valorFechado }
           });
        }

        // Handle Adendos
        if (contrato && row.adendos && Array.isArray(row.adendos)) {
           for (const adendo of row.adendos) {
              // Try to find exact adendo to not duplicate
              const existingAdendo = await prisma.adendo.findFirst({
                 where: {
                    contratoId: contrato.id,
                    descricao: adendo.descricao,
                    tenantId: userAuth.tenantId
                 }
              });
              
              if (!existingAdendo) {
                 await prisma.adendo.create({
                    data: {
                       descricao: adendo.descricao,
                       valor: adendo.valor,
                       contratoId: contrato.id,
                       tenantId: userAuth.tenantId
                    }
                 });
              }
           }
        }
      }
      
      insertedCount++;
    }

    return NextResponse.json({ 
      success: true,
      message: `${insertedCount} obras importadas/atualizadas com sucesso.`,
      count: insertedCount
    });

  } catch (error: any) {
    console.error('Erro ao efetivar CSV de Obras:', error);
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
