import { DEFAULT_SETTINGS, SETTING_KEYS, type CouponDefinition, type SiteSettings } from '@/lib/commerce';

export class CommercialInputError extends Error {}
export function commercialInteger(value: unknown, label: string, min = 0, max = 100_000_000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new CommercialInputError(`${label} must be a whole number between ${min} and ${max}.`);
  return value;
}
export function couponInput(body: unknown): Omit<CouponDefinition, 'id'> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CommercialInputError('Enter valid coupon details.');
  const value = body as Record<string, unknown>;
  const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) throw new CommercialInputError('Coupon codes need 2–40 letters, numbers, underscores or hyphens.');
  if (typeof value.enabled !== 'boolean') throw new CommercialInputError('Choose whether the coupon is active.');
  const expiresOn = value.expiresOn === '' || value.expiresOn == null ? null : value.expiresOn;
  if (expiresOn !== null && (typeof expiresOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || !Number.isFinite(Date.parse(expiresOn)) || new Date(expiresOn).toISOString().slice(0, 10) !== expiresOn)) throw new CommercialInputError('Enter a valid expiry date.');
  return { code, enabled: value.enabled, percentage: commercialInteger(value.percentage, 'Discount percent', 1, 100), minSubtotal: commercialInteger(value.minSubtotal ?? 0, 'Minimum order'), expiresOn };
}
export function settingsInput(body: unknown): SiteSettings {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CommercialInputError('Enter valid site settings.');
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some((key) => !SETTING_KEYS.includes(key as keyof SiteSettings))) throw new CommercialInputError('Unknown site setting.');
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of ['marqueeMessage1', 'marqueeMessage2'] as const) {
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 240) throw new CommercialInputError('Each marquee message needs 1–240 characters.');
    settings[key] = value[key].trim();
  }
  if (value.marqueeMessage3 !== undefined && value.marqueeMessage3 !== null) {
    if (typeof value.marqueeMessage3 !== 'string' || value.marqueeMessage3.length > 240) {
      throw new CommercialInputError('Marquee message 3 must be 240 characters or less.');
    }
    settings.marqueeMessage3 = value.marqueeMessage3.trim();
  }
  if (!settings.marqueeMessage2.includes('{freeDeliveryThreshold}')) throw new CommercialInputError('The second message must include {freeDeliveryThreshold} so delivery copy stays accurate.');
  settings.freeDeliveryThreshold = commercialInteger(value.freeDeliveryThreshold, 'Free-delivery threshold');
  settings.standardShippingFee = commercialInteger(value.standardShippingFee, 'Standard delivery fee');
  return settings;
}
