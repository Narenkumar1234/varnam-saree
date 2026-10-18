import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { coupons, siteSettings } from '@/db/schema';
import { requireAdminSession } from '@/lib/admin-session';
import { COUPONS_INITIALIZED } from '@/lib/commerce';
import { couponInput } from '@/lib/commercial-input';
import { commercialError, commercialHeaders } from '@/lib/commercial-admin';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try { return NextResponse.json({ coupons: await db.select().from(coupons).orderBy(coupons.id) }, { headers: commercialHeaders }); }
  catch (error) { return commercialError(error); }
}
export async function POST(request: NextRequest) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const value = couponInput(await request.json());
    const coupon = await db.transaction(async (tx) => {
      const [created] = await tx.insert(coupons).values(value).returning();
      await tx.insert(siteSettings).values({ key: COUPONS_INITIALIZED, value: 'true' }).onConflictDoUpdate({ target: siteSettings.key, set: { value: 'true' } });
      return created;
    });
    return NextResponse.json({ coupon }, { status: 201, headers: commercialHeaders });
  } catch (error) { return commercialError(error); }
}
