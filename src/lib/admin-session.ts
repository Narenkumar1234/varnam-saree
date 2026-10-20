import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'varnam_admin_session';
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
const SESSION_CONTEXT = 'varnam:studio-admin:session:v1';

function configuration() {
  const email = process.env.ADMIN_LOGIN_EMAIL;
  const password = process.env.ADMIN_LOGIN_PASSWORD;
  if (!email?.trim() || !password?.trim()) return null;
  const configuredSecret = process.env.ADMIN_SESSION_SECRET;
  const secret = configuredSecret?.trim() ? configuredSecret : password;
  // Domain-separated HMAC derivation. Bind the signing key to the password too,
  // so rotating the password or signing secret invalidates previously issued cookies.
  const key = createHmac('sha256', secret).update(SESSION_CONTEXT).update('\0').update(password).digest();
  return { email, password, key };
}

export function adminLoginConfigured(): boolean {
  return configuration() !== null;
}

export function configuredAdminEmail(): string | null {
  return configuration()?.email.trim() ?? null;
}

export function validAdminCredentials(email: unknown, password: unknown): boolean {
  const config = configuration();
  if (!config || typeof email !== 'string' || typeof password !== 'string' || email.length > 4096 || password.length > 4096) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  // Check both values without short-circuiting based on whether the email matches.
  const emailMatches = timingSafeEqual(digest(email), digest(config.email));
  const passwordMatches = timingSafeEqual(digest(password), digest(config.password));
  return emailMatches && passwordMatches;
}

export function createAdminSession(now = Date.now()): string {
  const config = configuration();
  if (!config) throw new Error('Admin login is not configured.');
  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    audience: 'studio-admin', version: 1, issuedAt,
    expiresAt: issuedAt + ADMIN_SESSION_SECONDS,
    nonce: randomBytes(24).toString('base64url'),
  })).toString('base64url');
  const signature = createHmac('sha256', config.key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function validAdminSession(token: string | undefined, now = Date.now()): boolean {
  const config = configuration();
  if (!config || !token || token.length > 2048) return false;
  const parts = token.split('.');
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
  const [payload, signature] = parts;
  const received = Buffer.from(signature, 'base64url');
  const expected = createHmac('sha256', config.key).update(payload).digest();
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const seconds = Math.floor(now / 1000);
    return session.audience === 'studio-admin' && session.version === 1 &&
      typeof session.nonce === 'string' && /^[A-Za-z0-9_-]{32}$/.test(session.nonce) &&
      Number.isSafeInteger(session.issuedAt) && Number.isSafeInteger(session.expiresAt) &&
      session.issuedAt <= seconds && session.expiresAt > seconds &&
      session.expiresAt - session.issuedAt === ADMIN_SESSION_SECONDS;
  } catch { return false; }
}

export function adminCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/admin' };
}

function sessionCookie(request: Request): string | undefined {
  const prefix = `${ADMIN_SESSION_COOKIE}=`;
  return request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

export function adminRequestHasSession(request: Request): boolean {
  return validAdminSession(sessionCookie(request));
}

export function rejectCrossOriginAdminMutation(request: Request): NextResponse | null {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return null;
  const origin = request.headers.get('origin');
  let matchesOrigin = true;
  if (origin) {
    try {
      // Next may reconstruct request.url with its internal hostname. Use the
      // public host/protocol supplied by the deployment proxy (or Host locally).
      const internal = new URL(request.url);
      const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || internal.host;
      const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || internal.protocol.slice(0, -1);
      matchesOrigin = ['http', 'https'].includes(protocol) && origin === new URL(`${protocol}://${host}`).origin;
    } catch { matchesOrigin = false; }
  }
  if (!matchesOrigin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Cross-origin admin requests are not allowed.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return null;
}

export function requireAdminSession(request: Request): NextResponse | null {
  if (!adminRequestHasSession(request)) {
    return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  return rejectCrossOriginAdminMutation(request);
}
