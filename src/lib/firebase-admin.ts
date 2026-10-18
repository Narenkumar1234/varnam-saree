import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export class CustomerAuthError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

// Lazy initialization keeps guest browsing/checkout usable without credentials.
// Explicit credentials are required; a project ID alone cannot enable login.
export function getCustomerAdminAuth() {
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if ((!file && !(projectId && clientEmail && privateKey)) || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new CustomerAuthError('Customer sign-in is not configured. Please continue as a guest.', 503);
  }
  try {
    const app = getApps().find((app) => app.name === 'varnam-customer-auth') || initializeApp({
      projectId: projectId || firebaseConfig.projectId,
      credential: file ? applicationDefault() : cert({ projectId, clientEmail, privateKey: privateKey!.replace(/\\n/g, '\n') }),
    }, 'varnam-customer-auth');
    return getAuth(app);
  } catch {
    throw new CustomerAuthError('Customer sign-in is not configured. Please continue as a guest.', 503);
  }
}
