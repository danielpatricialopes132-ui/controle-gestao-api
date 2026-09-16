import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import prisma from '@/lib/prisma'; 

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    // Regra de Ouro #2: Backend confia APENAS no token, nunca no body ou query
    const { tenantId } = await verifyIdToken(request);

    // Consulta isolada ao banco de dados com base no tenant_id do Token
    const clientes = await prisma.cliente.findMany({
      where: {
        tenantId: tenantId, 
      },
      orderBy: { nome: 'asc' },
    });

    return NextResponse.json(clientes, { status: 200 });

  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json(
      { error: 'Unauthorized or invalid request' },
      { status: 401 }
    );
  }
}

