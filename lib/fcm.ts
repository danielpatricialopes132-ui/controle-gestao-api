import { getMessaging } from 'firebase-admin/messaging';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import prisma from './prisma';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function sendPushToRole(tenantId: string, role: string, title: string, body: string) {
  try {
    const users = await prisma.usuario.findMany({
      where: {
        tenantId,
        role,
      },
    });

    const tokens: string[] = [];
    users.forEach(u => {
      if (u.fcmTokens && Array.isArray(u.fcmTokens)) {
        tokens.push(...u.fcmTokens);
      }
    });

    if (tokens.length === 0) {
      console.log(`No tokens found for role ${role} in tenant ${tenantId}`);
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      tokens,
    };

    const response = await getMessaging().sendMulticast(message);
    console.log(`Successfully sent message to ${response.successCount} devices`);
    if (response.failureCount > 0) {
      console.log(`Failed to send to ${response.failureCount} devices`);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
