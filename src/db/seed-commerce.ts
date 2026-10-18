import { coupons, siteSettings } from './schema';
import { COUPONS_INITIALIZED, DEFAULT_COUPONS, DEFAULT_SETTINGS, SETTING_KEYS } from '../lib/commerce';
import type { db } from './index';

export async function seedCommerce(database: typeof db) {
  await database.transaction(async (tx) => {
    // Only seed coupons the first time. Re-running setup must not restore deleted
    // codes or overwrite discounts, expiry dates, active states, or settings.
    const first = await tx.insert(siteSettings).values({ key: COUPONS_INITIALIZED, value: 'true' }).onConflictDoNothing().returning();
    if (first.length) await tx.insert(coupons).values(DEFAULT_COUPONS.map(({ id, ...coupon }) => coupon)).onConflictDoNothing({ target: coupons.code });
    for (const key of SETTING_KEYS) await tx.insert(siteSettings).values({ key, value: String(DEFAULT_SETTINGS[key]) }).onConflictDoNothing({ target: siteSettings.key });
  });
}
