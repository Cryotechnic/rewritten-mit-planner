import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function getDb() {
  if (getApps().length === 0) {
    const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim();
    if (raw) {
      // Supports JSON string only (no file paths in Vercel serverless)
      const sa: ServiceAccount = JSON.parse(raw);
      initializeApp({ credential: cert(sa) });
    } else {
      // Application Default Credentials (if configured in Vercel)
      initializeApp();
    }
  }
  return getFirestore();
}
