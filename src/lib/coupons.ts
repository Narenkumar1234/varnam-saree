export interface CouponDefinition {
  code: string;
  percentage: number;
  enabled: boolean;
}

// Add future offers here. One coupon can be applied to an order at a time.
export const COUPONS: readonly CouponDefinition[] = [
  { code: 'OFFER50', percentage: 50, enabled: true },
  { code: 'WELCOME10', percentage: 10, enabled: true },
];

export type CouponValidation =
  | { valid: true; coupon: CouponDefinition }
  | { valid: false; error: string };

export function validateCoupon(input: unknown): CouponValidation {
  if (typeof input !== 'string' || !input.trim()) {
    return { valid: false, error: 'Enter a coupon code.' };
  }

  const code = input.trim().toUpperCase();
  const coupon = COUPONS.find((entry) => entry.code === code && entry.enabled);
  if (!coupon || !Number.isFinite(coupon.percentage) || coupon.percentage <= 0 || coupon.percentage > 100) {
    return { valid: false, error: 'This coupon code is invalid or unavailable. Please check the code.' };
  }

  return { valid: true, coupon };
}

export function getCouponDiscount(subtotal: number, code: string | null | undefined): number {
  if (!code) return 0;
  const result = validateCoupon(code);
  return result.valid ? Math.round(subtotal * result.coupon.percentage / 100) : 0;
}
