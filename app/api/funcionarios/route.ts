import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (!userAuth || !userAuth.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;

    const funcionarios = await prisma.funcionario.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' }
    });

    return NextResponse.json({ success: true, data: funcionarios });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const userAuth = await verifyIdToken(request);
    if (!userAuth || !userAuth.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    
    if (!body.nome || !body.cargo) {
      return NextResponse.json({ success: false, error: 'Nome e Cargo são obrigatórios' }, { status: 400 });
    }

    const func = await prisma.funcionario.create({
      data: {
        nome: body.nome,
        cargo: body.cargo,
        salario: body.salario ? parseFloat(body.salario) : null,
        valorDiariaMotorista: body.valorDiariaMotorista ? parseFloat(body.valorDiariaMotorista) : null,
        tenantId: tenantId,
      }
    });

    return NextResponse.json({ success: true, data: func });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}


