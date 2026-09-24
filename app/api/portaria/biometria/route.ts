import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fotoBase64, tenantId, obraId } = body;

    if (!fotoBase64 || !tenantId || !obraId) {
      return NextResponse.json({ error: 'Campos obrigatórios: fotoBase64, tenantId, obraId' }, { status: 400 });
    }

    // TODO: Integração com ML Kit / Face API para comparar a fotoBase64 recebida
    // com a fotoBiometria dos TerceirosMontadores / Clientes
    
    // Por enquanto, retornamos um esqueleto (Groundwork)
    return NextResponse.json({ 
      success: true, 
      message: 'Esqueleto de biometria preparado. ML Match pendente.',
      match: false
    }, { status: 200 });

  } catch (error: any) {
    console.error('Erro na biometria:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
