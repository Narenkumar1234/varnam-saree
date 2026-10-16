import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';

export async function POST(req: NextRequest) {
  try {
    const { uid, email, name } = await req.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'UID and email are required' }, { status: 400 });
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        name: name || email.split('@')[0],
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name: name || email.split('@')[0],
        },
      })
      .returning();

    return NextResponse.json({ success: true, user: result[0] });
  } catch (error: any) {
    console.error('Failed to sync user with database:', error);
    return NextResponse.json(
      { error: 'Failed to sync user with database' },
      { status: 500 }
    );
  }
}
