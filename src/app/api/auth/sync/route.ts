import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireCustomerIdentity, customerAuthFailure, customerPrivateHeaders } from '@/lib/customer-auth-server';

export async function POST(req: NextRequest) {
  try {
    // Identity comes exclusively from the verified ID token, never the body.
    const profile = await requireCustomerIdentity(req);
    await db.insert(users).values(profile).onConflictDoUpdate({
      target: users.uid,
      set: { email: profile.email, name: profile.name },
    });
    return NextResponse.json({ success: true, user: profile }, { headers: customerPrivateHeaders });
  } catch (error) {
    const denied = customerAuthFailure(error);
    if (denied) return denied;
    console.error('Failed to sync verified customer with database');
    return NextResponse.json({ error: 'Your account could not be loaded. Please retry or continue as a guest.' }, { status: 503, headers: customerPrivateHeaders });
  }
}
