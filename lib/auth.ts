import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function verifyIdToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await getAuth().verifyIdToken(token);
  
  // Buscar o usuário no banco de dados
  const usuario = await prisma.usuario.findUnique({
    where: { firebaseUid: decodedToken.uid },
  });

  if (!usuario) {
    throw new Error('User not found in database');
  }

  // Bloquear alterações (POST, PUT, DELETE, PATCH) se o usuário estiver PENDENTE
  const method = request.method;
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && usuario.status === 'PENDENTE') {
    throw new Error('Acesso negado: Usuário pendente de aprovação.');
  }

  const isMaster = usuario.role === 'MASTER';
  const tenantOverride = request.headers.get('x-tenant-override');

  let finalTenantId = usuario.tenantId;
  
  // Se for MASTER e enviou override, usar o override
  if (isMaster && tenantOverride) {
    finalTenantId = tenantOverride;
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    role: usuario.role,
    status: usuario.status,
    tenantId: finalTenantId,
    dbId: usuario.id
  };
}
