const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
require('dotenv').config();

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = getAuth();

async function createUsers() {
  const users = [
    { email: 'danielsmlopes@hotmail.com', password: 'Gabriel2006' },
    { email: 'patigrubel@gmail.com', password: 'Maraca132@' }
  ];

  for (const user of users) {
    try {
      const userRecord = await auth.createUser({
        email: user.email,
        password: user.password,
      });
      console.log('Successfully created new user:', userRecord.uid);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('User already exists:', user.email);
        const existingUser = await auth.getUserByEmail(user.email);
        await auth.updateUser(existingUser.uid, { password: user.password });
        console.log('Updated password for existing user:', existingUser.uid);
      } else {
        console.error('Error creating user:', error);
      }
    }
  }
}

createUsers().catch(console.error);
