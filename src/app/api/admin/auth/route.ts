import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE, ADMIN_SESSION_SECONDS, adminCookieOptions,
  adminLoginConfigured, createAdminSession, rejectCrossOriginAdminMutation,
  requireAdminSession, validAdminPasscode,
} from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  if (!adminLoginConfigured()) {
    return NextResponse.json({ error: 'Admin login is not configured.' }, { status: 503, headers });
  }
  const denied = requireAdminSession(req);
  return denied || NextResponse.json({ success: true, role: 'boutique_manager' }, { headers });
}

export async function POST(req: NextRequest) {
  const crossOrigin = rejectCrossOriginAdminMutation(req);
  if (crossOrigin) return crossOrigin;
  if (!adminLoginConfigured()) {
    return NextResponse.json({ error: 'Admin login is not configured.' }, { status: 503, headers });
  }
  try {
    const body = await req.json();
    if (!validAdminPasscode(body?.passcode)) {
      return NextResponse.json({ error: 'Invalid Studio passcode.' }, { status: 401, headers });
    }
    const response = NextResponse.json({ success: true, role: 'boutique_manager' }, { headers });
    response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSession(), { ...adminCookieOptions(), maxAge: ADMIN_SESSION_SECONDS });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? 'Invalid login request.' : 'Authentication failed.' }, { status: error instanceof SyntaxError ? 400 : 500, headers });
  }
}

export async function DELETE(req: NextRequest) {
  const crossOrigin = rejectCrossOriginAdminMutation(req);
  if (crossOrigin) return crossOrigin;
  const response = NextResponse.json({ success: true }, { headers });
  response.cookies.set(ADMIN_SESSION_COOKIE, '', { ...adminCookieOptions(), maxAge: 0, expires: new Date(0) });
  return response;
}
