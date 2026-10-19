import { NextRequest, NextResponse } from 'next/server';
import { CustomerAuthError, CUSTOMER_AUTH_MESSAGES, safeAuthReason, type CustomerAuthCode } from '@/lib/customer-auth-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

export async function POST(req: NextRequest) {
  let stage: 'verification-import' | 'verification' | 'account-storage-import' | 'account-storage' = 'verification-import';
  try {
    const { requireCustomerIdentity } = await import('@/lib/customer-auth-server');
    stage = 'verification';
    const profile = await requireCustomerIdentity(req);
    stage = 'account-storage-import';

    // In production without a database configured (e.g. initial Vercel setup), skip DB safely.
    const isDbConfigured = Boolean(process.env.SQL_HOST || process.env.NODE_ENV === 'test');
    if (isDbConfigured) {
      const [{ db }, { users }] = await Promise.all([import('@/db'), import('@/db/schema')]);
      stage = 'account-storage';
      await db.insert(users).values(profile).onConflictDoUpdate({
        target: users.uid,
        set: { email: profile.email, name: profile.name },
      });
    }

    return NextResponse.json({ success: true, user: profile }, { headers });
  } catch (error) {
    const code: CustomerAuthCode = error instanceof CustomerAuthError ? error.code
      : stage === 'verification-import' ? 'CUSTOMER_AUTH_INITIALIZATION_FAILED'
      : stage === 'verification' ? 'CUSTOMER_AUTH_VERIFICATION_UNAVAILABLE'
      : 'CUSTOMER_ACCOUNT_UNAVAILABLE';
    const status = error instanceof CustomerAuthError ? error.status : 503;
    console.error('[customer-auth/sync]', { stage, code, reason: error instanceof CustomerAuthError ? error.reason || error.code : safeAuthReason(error) });
    return NextResponse.json({ error: CUSTOMER_AUTH_MESSAGES[code], code }, { status, headers });
  }
}
