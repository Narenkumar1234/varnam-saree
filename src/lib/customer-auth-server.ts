import { NextResponse } from 'next/server';
import { getCustomerAdminAuth } from '@/lib/firebase-admin';
import { CustomerAuthError, CUSTOMER_AUTH_MESSAGES, safeAuthReason, type CustomerAuthCode } from '@/lib/customer-auth-errors';
import type { UserProfile } from '@/types';

export { CustomerAuthError };
export const customerPrivateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

export async function requireCustomerIdentity(req: Request): Promise<UserProfile> {
  const fail = (code: CustomerAuthCode, status: number, reason?: string): never => {
    throw new CustomerAuthError(CUSTOMER_AUTH_MESSAGES[code], status, code, reason);
  };
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') || '');
  if (!match) return fail('CUSTOMER_AUTH_REQUIRED', 401);

  const token = match[1];
  let claims: any;

  try {
    const auth = await getCustomerAdminAuth();
    claims = await auth.verifyIdToken(token, true);
  } catch (error: any) {
    if (error instanceof CustomerAuthError) throw error;
    const code = (error as { code?: string }).code || '';
    if (['auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(code)) {
      return fail('CUSTOMER_AUTH_TOKEN_REJECTED', 401, safeAuthReason(error));
    }
    if (['app/invalid-credential', 'auth/invalid-credential', 'auth/insufficient-permission', 'auth/project-not-found'].includes(code)) {
      return fail('CUSTOMER_AUTH_INVALID_CREDENTIALS', 503, safeAuthReason(error));
    }
    return fail('CUSTOMER_AUTH_VERIFICATION_UNAVAILABLE', 503, safeAuthReason(error));
  }

  const uid = (claims.uid || claims.user_id || claims.sub) as string;
  const email = claims.email as string;
  const emailVerified = claims.email_verified;
  const provider = claims.firebase?.sign_in_provider;

  if (!uid || !email || emailVerified !== true || (provider && provider !== 'google.com')) {
    return fail('CUSTOMER_AUTH_IDENTITY_REQUIRED', 401);
  }

  return {
    uid,
    email,
    name: typeof claims.name === 'string' && claims.name.trim() ? claims.name : email.split('@')[0],
  };
}

export function customerAuthFailure(error: unknown) {
  return error instanceof CustomerAuthError
    ? NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: customerPrivateHeaders })
    : null;
}
