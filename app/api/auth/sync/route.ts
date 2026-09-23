import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { PrismaClient } from '@prisma/client';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);

    let usuario = await prisma.usuario.findUnique({
      where: { firebaseUid: decodedToken.uid },
    });

    if (!usuario) {
      // Usuário novo! Atrelar à empresa TESTE LTDA por padrão
      const testeTenant = await prisma.tenant.findUnique({
        where: { documento: '00000000000000' }
      });

      if (!testeTenant) {
        return NextResponse.json({ error: 'Empresa padrão não encontrada' }, { status: 500 });
      }

      // Verifica se o e-mail pertence a um Cliente cadastrado
      const clienteExistente = await prisma.cliente.findFirst({
        where: { 
          email: decodedToken.email,
          tenantId: testeTenant.id // Assumindo que o cliente pertence ao mesmo tenant
        }
      });

      const roleInicial = clienteExistente ? 'CLIENTE' : 'USER';
      const statusInicial = clienteExistente ? 'ATIVO' : 'PENDENTE';

      usuario = await prisma.usuario.create({
        data: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || '',
          nome: decodedToken.name || decodedToken.email?.split('@')[0] || 'Usuário',
          role: roleInicial,
          status: statusInicial,
          tenantId: testeTenant.id
        }
      });

      if (roleInicial === 'USER') {
        try {
          const { sendPushToRole } = await import('@/lib/fcm');
          await sendPushToRole(
            testeTenant.id, 
            'MASTER', 
            'Novo Usuário Pendente', 
            `O usuário ${usuario.nome} se cadastrou e aguarda aprovação.`
          );
        } catch (pushErr) {
          console.error('Erro ao enviar push notification:', pushErr);
        }
      }
    }

    return NextResponse.json({ 
      user: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        role: usuario.role,
        status: usuario.status,
        tenantId: usuario.tenantId
      }
    });
  } catch (error: any) {
    console.error('Auth sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

