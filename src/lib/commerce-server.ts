import { db } from '@/db';
import { coupons, siteSettings } from '@/db/schema';
import { COUPONS_INITIALIZED, DEFAULT_COUPONS, settingsFromRows, type CommerceConfig } from '@/lib/commerce';

// Read afresh for every order/public refresh. Disabled/deleted coupons must not
// be replaced with defaults while the configured database is reachable.
export async function getCommerce(): Promise<CommerceConfig> {
  const [couponRead, settingsRead] = await Promise.allSettled([
    db.select().from(coupons).orderBy(coupons.id),
    db.select().from(siteSettings),
  ]);
  const rows = settingsRead.status === 'fulfilled' ? settingsRead.value : [];
  const initialized = rows.some((row) => row.key === COUPONS_INITIALIZED && row.value === 'true');
  return {
    settings: settingsFromRows(rows),
    coupons: couponRead.status === 'fulfilled' && (couponRead.value.length || initialized)
      ? couponRead.value : DEFAULT_COUPONS.map((coupon) => ({ ...coupon })),
  };
}
