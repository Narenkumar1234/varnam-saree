export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export class FirebaseConfigError extends Error {
  constructor(message: string, public readonly code: 'CUSTOMER_AUTH_CLIENT_NOT_CONFIGURED' | 'CUSTOMER_AUTH_PROJECT_MISMATCH' = 'CUSTOMER_AUTH_CLIENT_NOT_CONFIGURED') { super(message); }
}

// Direct references are required so Next.js includes these PUBLIC values in the
// browser bundle. Private service-account fields must never enter this module.
export function getFirebasePublicConfig(values: Partial<FirebasePublicConfig> = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}): FirebasePublicConfig {
  const config = {
    apiKey: values.apiKey?.trim() || '',
    authDomain: values.authDomain?.trim() || '',
    projectId: values.projectId?.trim() || '',
    appId: values.appId?.trim() || '',
  };
  if (Object.values(config).some((value) => !value)) {
    throw new FirebaseConfigError('Customer Google sign-in is not configured. Please continue as a guest.');
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(config.projectId) || !/^[a-z0-9.-]+$/i.test(config.authDomain)) {
    throw new FirebaseConfigError('Customer Google sign-in configuration is invalid. Please contact the store.');
  }
  // Custom auth domains are supported only when their Firebase hosting/proxy is
  // configured by the owner. A default Firebase domain must match the project.
  if (config.authDomain.endsWith('.firebaseapp.com') && config.authDomain !== config.projectId + '.firebaseapp.com') {
    throw new FirebaseConfigError('The Google sign-in domain and Firebase project do not match. Please contact the store.', 'CUSTOMER_AUTH_PROJECT_MISMATCH');
  }
  return config;
}
