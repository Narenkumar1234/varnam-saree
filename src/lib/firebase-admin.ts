import { getFirebasePublicConfig } from '@/lib/firebase-config';
import { CustomerAuthError, CUSTOMER_AUTH_MESSAGES, safeAuthReason } from '@/lib/customer-auth-errors';

export { CustomerAuthError };

// Accept PEM with real newlines, Vercel literal \\n / \\\\n, CRLF and optional
// surrounding quotes. The Admin SDK still validates the resulting private key.
const cleanScalarEnv = (value?: string) =>
  value?.trim().replace(/,+$/, '').trim().replace(/^["']|["']$/g, '').trim();

export function normalizeFirebasePrivateKey(value: string): string {
  let key = value.trim().replace(/,+$/, '').trim();
  if (key.startsWith('{') && key.endsWith('}')) {
    try {
      const obj = JSON.parse(key) as { private_key?: string };
      if (typeof obj.private_key === 'string') key = obj.private_key.trim();
    } catch {}
  } else if (/^["']?private_key["']?\s*:/.test(key)) {
    key = key.replace(/^["']?private_key["']?\s*:\s*/, '').replace(/,+$/, '').trim();
  }
  if (key.startsWith('"') && key.endsWith('"')) {
    try { const parsed: unknown = JSON.parse(key); if (typeof parsed === 'string') key = parsed; }
    catch { key = key.slice(1, -1); }
  } else if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);
  return key.replace(/\\+r\\+n/g, '\n').replace(/\\+n/g, '\n').replace(/\r\n?/g, '\n').trim();
}

import { createRequire } from 'module';

async function loadFirebaseAdminSdk() {
  try {
    const [{ applicationDefault, cert, getApps, initializeApp }, { getAuth }] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
    ]);
    return { applicationDefault, cert, getApps, initializeApp, getAuth };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const msg = (err as { message?: string })?.message;
    if (code === 'ERR_REQUIRE_ESM' || (typeof msg === 'string' && msg.includes('ERR_REQUIRE_ESM'))) {
      const require = createRequire(import.meta.url);
      const app = require('firebase-admin/app');
      const auth = require('firebase-admin/auth');
      return {
        applicationDefault: app.applicationDefault,
        cert: app.cert,
        getApps: app.getApps,
        initializeApp: app.initializeApp,
        getAuth: auth.getAuth,
      };
    }
    throw err;
  }
}

export async function getCustomerAdminAuth() {
  const fail = (code: 'CUSTOMER_AUTH_NOT_CONFIGURED' | 'CUSTOMER_AUTH_PROJECT_MISMATCH' | 'CUSTOMER_AUTH_INVALID_CREDENTIALS', reason?: string): never => {
    throw new CustomerAuthError(CUSTOMER_AUTH_MESSAGES[code], 503, code, reason);
  };
  const file = cleanScalarEnv(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const projectId = cleanScalarEnv(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = cleanScalarEnv(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if ((!file && !(projectId && clientEmail && privateKey)) || process.env.FIREBASE_AUTH_EMULATOR_HOST) fail('CUSTOMER_AUTH_NOT_CONFIGURED');
  let expectedProject: string;
  try { expectedProject = getFirebasePublicConfig().projectId; }
  catch { return fail('CUSTOMER_AUTH_NOT_CONFIGURED'); }
  if (projectId && projectId !== expectedProject) fail('CUSTOMER_AUTH_PROJECT_MISMATCH');
  try {
    // Load SDK code inside the request's guarded boundary, not at module load.
    const { applicationDefault, cert, getApps, initializeApp, getAuth } = await loadFirebaseAdminSdk();
    const name = 'varnam-customer-auth';
    const existing = getApps().find((app: { name: string; options: { projectId?: string } }) => app.name === name);
    if (existing && existing.options.projectId !== expectedProject) fail('CUSTOMER_AUTH_PROJECT_MISMATCH');
    const app = existing || initializeApp({
      // Always verify the same audience/issuer as the browser's Firebase app.
      projectId: expectedProject,
      credential: file ? applicationDefault() : cert({
        projectId: expectedProject, clientEmail, privateKey: normalizeFirebasePrivateKey(privateKey!),
      }),
    }, name);
    return getAuth(app);
  } catch (error) {
    if (error instanceof CustomerAuthError) throw error;
    return fail('CUSTOMER_AUTH_INVALID_CREDENTIALS', safeAuthReason(error));
  }
}
