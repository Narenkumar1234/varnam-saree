import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth, getAuth, GoogleAuthProvider, indexedDBLocalPersistence,
  browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver,
} from 'firebase/auth';
import { getFirebasePublicConfig } from '@/lib/firebase-config';

let client: { auth: ReturnType<typeof getAuth>; googleAuthProvider: GoogleAuthProvider } | undefined;

// Lazy: incomplete auth config must never crash guest storefront routes.
export function getCustomerFirebase() {
  if (client) return client;
  const config = getFirebasePublicConfig();
  const app = getApps().find((app) => app.name === 'varnam-customer') || initializeApp(config, 'varnam-customer');
  let auth: ReturnType<typeof getAuth>;
  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/already-initialized') throw error;
    auth = getAuth(app);
  }
  const googleAuthProvider = new GoogleAuthProvider();
  googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
  client = { auth, googleAuthProvider };
  return client;
}
