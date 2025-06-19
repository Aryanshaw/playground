// firebase-admin.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import serviceAccount from '../src/playground-50326-firebase-adminsdk-fbsvc-3e93d88010.json'; // Download this file

// Initialize Firebase Admin SDK only once
let app;
if (getApps().length === 0) {
  app = initializeApp({
    credential: cert(serviceAccount as any),
    projectId: 'playground-50326',
  });
} else {
  app = getApps()[0];
}

export const adminAuth = getAuth(app);
export default app;