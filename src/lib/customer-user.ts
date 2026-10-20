import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireCustomerIdentity } from '@/lib/customer-auth-server';
import type { UserProfile } from '@/types';

export async function requireCustomerUser(req: Request): Promise<{ identity: UserProfile; user: typeof users.$inferSelect }> {
  const identity = await requireCustomerIdentity(req);
  const existing = await db.select().from(users).where(eq(users.uid, identity.uid)).limit(1);
  if (existing[0]) return { identity, user: existing[0] };
  const [user] = await db.insert(users).values({
    uid: identity.uid,
    email: identity.email,
    name: identity.name,
  }).onConflictDoUpdate({
    target: users.uid,
    set: { email: identity.email, name: identity.name },
  }).returning();
  return { identity, user };
}
