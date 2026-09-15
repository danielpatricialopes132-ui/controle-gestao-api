import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function verifyIdToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  const MASTER_EMAILS = ['danielsmlopes@hotmail.com', 'patigrubel@gmail.com'];
  const isMaster = decodedToken.email && MASTER_EMAILS.includes(decodedToken.email);
  
  const tenantOverride = request.headers.get('x-tenant-override');

  if (!isMaster && !decodedToken.tenant_id) {
    throw new Error('Tenant ID missing in token claims');
  }

  let finalTenantId = decodedToken.tenant_id as string;
  if (isMaster) {
    finalTenantId = tenantOverride ? tenantOverride : 'MASTER_TENANT';
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    role: isMaster ? 'MASTER' : 'USER',
    tenantId: finalTenantId,
  };
}
