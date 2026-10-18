import type { CouponDefinition } from '@/lib/commerce';
export type { CouponDefinition } from '@/lib/commerce';

export type CouponValidation =
  | { valid: true; coupon: CouponDefinition }
  | { valid: false; error: string };

export function validateCoupon(input: unknown, coupons: CouponDefinition[], subtotal = 0, now = new Date()): CouponValidation {
  if (typeof input !== 'string' || !input.trim()) return { valid: false, error: 'Enter a coupon code.' };
  const code = input.trim().toUpperCase();
  const coupon = coupons.find((entry) => entry.code === code);
  if (!coupon || !Number.isInteger(coupon.percentage) || coupon.percentage <= 0 || coupon.percentage > 100) return { valid: false, error: 'This coupon code is invalid or unavailable. Please check the code.' };
  if (!coupon.enabled) return { valid: false, error: 'This coupon is inactive. Please remove it or use another code.' };
  if (coupon.expiresOn && now.toISOString().slice(0, 10) > coupon.expiresOn) return { valid: false, error: 'This coupon has expired. Please use another code.' };
  if (subtotal < coupon.minSubtotal) return { valid: false, error: `This coupon requires a minimum order of ₹${coupon.minSubtotal.toLocaleString('en-IN')} before discounts.` };
  return { valid: true, coupon };
}
export function getCouponDiscount(subtotal: number, code: string | null | undefined, coupons: CouponDefinition[]): number {
  if (!code) return 0;
  const result = validateCoupon(code, coupons, subtotal);
  return result.valid ? Math.round(subtotal * result.coupon.percentage / 100) : 0;
}
