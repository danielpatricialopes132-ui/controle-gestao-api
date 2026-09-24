import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (!userAuth || !userAuth.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
    
    const tenantId = userAuth.tenantId;
    const body = await request.json();
    
    if (!body.presencas || !Array.isArray(body.presencas)) {
      return NextResponse.json({ success: false, error: 'A lista de presenças (presencas) é obrigatória e deve ser um array.' }, { status: 400 });
    }

    // Format the data array for createMany
    const presencasData = body.presencas.map((p: any) => ({
      data: p.data,
      status: p.status,
      observacao: p.observacao,
      funcionarioId: p.funcionarioId,
      obraId: p.obraId,
      tenantId: tenantId,
    }));

    // Use Prisma transaction to delete existing presences for these employees on this date/obra, then insert new ones.
    // Assuming 'data' and 'obraId' are the same for all entries in the batch (Diário de Obra).
    if (presencasData.length > 0) {
      const targetDate = presencasData[0].data;
      const targetObraId = presencasData[0].obraId;

      // Ensure all entries have the same date and obraId for this specific batch logic
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      await prisma.$transaction([
        // Delete existing records for these employees on this day and obra to avoid duplicates
        prisma.registroPresenca.deleteMany({
          where: {
            tenantId,
            obraId: targetObraId,
            data: {
              gte: startOfDay.toISOString(),
              lte: endOfDay.toISOString(),
            },
            funcionarioId: {
              in: presencasData.map((p: any) => p.funcionarioId),
            }
          }
        }),
        // Insert new records
        prisma.registroPresenca.createMany({
          data: presencasData
        })
      ]);
    }

    return NextResponse.json({ success: true, count: presencasData.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
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
