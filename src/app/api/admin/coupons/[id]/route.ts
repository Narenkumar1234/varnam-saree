import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { coupons, siteSettings } from '@/db/schema';
import { requireAdminSession } from '@/lib/admin-session';
import { COUPONS_INITIALIZED } from '@/lib/commerce';
import { couponInput, commercialInteger } from '@/lib/commercial-input';
import { commercialError, commercialHeaders } from '@/lib/commercial-admin';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const id = commercialInteger(Number((await context.params).id), 'Coupon ID', 1, 2_147_483_647);
    const value = couponInput(await request.json());
    const coupon = await db.transaction(async (tx) => {
      const [updated] = await tx.update(coupons).set(value).where(eq(coupons.id, id)).returning();
      if (updated) await tx.insert(siteSettings).values({ key: COUPONS_INITIALIZED, value: 'true' }).onConflictDoUpdate({ target: siteSettings.key, set: { value: 'true' } });
      return updated;
    });
    return coupon ? NextResponse.json({ coupon }, { headers: commercialHeaders }) : NextResponse.json({ error: 'Coupon not found.' }, { status: 404 });
  } catch (error) { return commercialError(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const id = commercialInteger(Number((await context.params).id), 'Coupon ID', 1, 2_147_483_647);
    const removed = await db.transaction(async (tx) => {
      const result = await tx.delete(coupons).where(eq(coupons.id, id)).returning();
      if (result.length) await tx.insert(siteSettings).values({ key: COUPONS_INITIALIZED, value: 'true' }).onConflictDoUpdate({ target: siteSettings.key, set: { value: 'true' } });
      return result.length > 0;
    });
    return removed ? NextResponse.json({ success: true }, { headers: commercialHeaders }) : NextResponse.json({ error: 'Coupon not found.' }, { status: 404 });
  } catch (error) { return commercialError(error); }
}
