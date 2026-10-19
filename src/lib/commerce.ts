export interface CouponDefinition {
  id?: number;
  code: string;
  percentage: number;
  enabled: boolean;
  minSubtotal: number;
  /** Inclusive expiry date, in UTC. */
  expiresOn: string | null;
}

export interface SiteSettings {
  marqueeMessage1: string;
  marqueeMessage2: string;
  marqueeMessage3?: string;
  freeDeliveryThreshold: number;
  standardShippingFee: number;
}

export interface CommerceConfig { coupons: CouponDefinition[]; settings: SiteSettings }

// Only fallback defaults and seed data. A configured database is authoritative.
export const DEFAULT_COUPONS: CouponDefinition[] = [
  { code: 'OFFER50', percentage: 50, enabled: true, minSubtotal: 0, expiresOn: null },
  { code: 'WELCOME10', percentage: 10, enabled: true, minSubtotal: 0, expiresOn: null },
];
export const DEFAULT_SETTINGS: SiteSettings = {
  marqueeMessage1: 'Dispatch time 2 to 5 business days',
  marqueeMessage2: 'Free delivery on orders above {freeDeliveryThreshold}',
  marqueeMessage3: '',
  freeDeliveryThreshold: 2999,
  standardShippingFee: 150,
};
export const DEFAULT_COMMERCE: CommerceConfig = { coupons: DEFAULT_COUPONS, settings: DEFAULT_SETTINGS };
export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[];
export const COUPONS_INITIALIZED = 'couponsInitialized';

export function renderMarquee(message?: string | null, settings?: SiteSettings): string {
  if (!message) return '';
  const threshold = settings?.freeDeliveryThreshold ?? 2999;
  return message.replaceAll('{freeDeliveryThreshold}', `₹${threshold.toLocaleString('en-IN')}`);
}
export function freeDeliveryCopy(settings: SiteSettings): string {
  return settings.standardShippingFee === 0 || settings.freeDeliveryThreshold === 0
    ? 'Free delivery on all orders'
    : `Free delivery on orders above ₹${settings.freeDeliveryThreshold.toLocaleString('en-IN')}`;
}
export function deliveryCharge(subtotal: number, settings: SiteSettings): number {
  return subtotal === 0 || subtotal > settings.freeDeliveryThreshold ? 0 : settings.standardShippingFee;
}
export function settingsFromRows(rows: { key: string; value: string }[]): SiteSettings {
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (key === 'freeDeliveryThreshold' || key === 'standardShippingFee') {
      const number = Number(value);
      if (value.trim() && Number.isSafeInteger(number) && number >= 0 && number <= 100_000_000) settings[key] = number;
    } else if ((key === 'marqueeMessage1' || key === 'marqueeMessage2') && value.trim() && value.length <= 240) {
      if (key !== 'marqueeMessage2' || value.includes('{freeDeliveryThreshold}')) settings[key] = value;
    } else if (key === 'marqueeMessage3') {
      settings[key] = value ? (value.length <= 240 ? value : value.slice(0, 240)) : '';
    }
  }
  return settings;
}
