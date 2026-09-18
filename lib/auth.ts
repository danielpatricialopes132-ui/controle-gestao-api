import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'controle-gestao-ea7ad.appspot.com',
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

import { getStorage } from 'firebase-admin/storage';

export async function uploadToStorage(base64: string, destination: string, mimeType: string): Promise<string> {
  const bucket = getStorage().bucket();
  const file = bucket.file(destination);
  
  // Remove possible data prefix like "data:image/jpeg;base64,"
  const base64Data = base64.replace(/^data:\w+\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  await file.save(buffer, {
    metadata: { contentType: mimeType },
    public: true, // We make it public to be able to access the URL easily
  });
  
  // Since we made it public, we can construct the public URL
  const bucketName = bucket.name;
  return `https://storage.googleapis.com/${bucketName}/${destination}`;
}
