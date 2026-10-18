import { NextResponse } from 'next/server';
import { CustomerAuthError, getCustomerAdminAuth } from '@/lib/firebase-admin';
import type { UserProfile } from '@/types';

export { CustomerAuthError };
export const customerPrivateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

export async function requireCustomerIdentity(req: Request): Promise<UserProfile> {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') || '');
  if (!match) throw new CustomerAuthError('Sign in with Google to access your account.', 401);
  const auth = getCustomerAdminAuth();
  let claims;
  try {
    // Verify signature, audience, issuer, expiry AND revoked/disabled-user state.
    claims = await auth.verifyIdToken(match[1], true);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(code || '')) {
      throw new CustomerAuthError('Your sign-in could not be verified. Please sign in with Google again.', 401);
    }
    throw new CustomerAuthError('Customer sign-in could not be verified right now. Please retry or continue as a guest.', 503);
  }
  if (!claims.uid || !claims.email || claims.email_verified !== true || claims.firebase?.sign_in_provider !== 'google.com') {
    throw new CustomerAuthError('Sign in with a verified Google account to continue.', 401);
  }
  return { uid: claims.uid, email: claims.email, name: typeof claims.name === 'string' && claims.name.trim() ? claims.name : claims.email.split('@')[0] };
}

export function customerAuthFailure(error: unknown) {
  return error instanceof CustomerAuthError
    ? NextResponse.json({ error: error.message }, { status: error.status, headers: customerPrivateHeaders })
    : null;
}
