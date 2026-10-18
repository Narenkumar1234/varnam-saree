import { getProductById } from '@/data/products';
import { validateCoupon } from '@/lib/coupons';
import type { CartItem, OrderItem, OrderPricing, OrderQuote } from '@/types';

export class OrderPricingError extends Error {}

export function calculateOrderQuote(items: CartItem[], code?: string | null): OrderQuote {
  const validation = code ? validateCoupon(code) : null;
  if (validation && !validation.valid) throw new OrderPricingError(validation.error);
  const coupon = validation?.valid ? validation.coupon : undefined;

  const pricedItems = items.map((item) => {
    const product = getProductById(item.id);
    if (!product || !Number.isSafeInteger(item.qty) || item.qty < 1) {
      throw new OrderPricingError('Your bag contains an unavailable saree or an invalid quantity.');
    }
    const subtotal = product.price * item.qty;
    if (!Number.isSafeInteger(subtotal) || subtotal > 2_147_483_497) {
      throw new OrderPricingError('The selected quantity is too large. Please reduce it.');
    }
    return {
      id: product.id,
      qty: item.qty,
      finish: typeof item.finish === 'string' ? item.finish : 'Unstitched blouse · included',
      name: product.name,
      unitPrice: product.price,
      subtotal,
      discountAmount: Math.floor(subtotal * (coupon?.percentage || 0) / 100),
      total: subtotal,
    };
  });

  const subtotal = pricedItems.reduce((sum, item) => sum + item.subtotal, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal > 2_147_483_497) {
    throw new OrderPricingError('The order total is too large. Please reduce the quantity.');
  }
  const discountAmount = Math.round(subtotal * (coupon?.percentage || 0) / 100);

  // Allocate any rounding difference so line totals always add up to the order total.
  let remainder = discountAmount - pricedItems.reduce((sum, item) => sum + item.discountAmount, 0);
  const remainderOrder = [...pricedItems].sort((a, b) =>
    (b.subtotal * (coupon?.percentage || 0) % 100) -
    (a.subtotal * (coupon?.percentage || 0) % 100)
  );
  for (const item of remainderOrder) {
    if (remainder <= 0) break;
    item.discountAmount += 1;
    remainder -= 1;
  }
  for (const item of pricedItems) item.total = item.subtotal - item.discountAmount;

  const shipping = subtotal === 0 || subtotal >= 3000 ? 0 : 150;
  return {
    items: pricedItems,
    pricing: {
      subtotal,
      discountAmount,
      shipping,
      total: subtotal - discountAmount + shipping,
      ...(coupon ? { couponCode: coupon.code, discountPercentage: coupon.percentage } : {}),
    },
  };
}

export function parseOrderItems(input: unknown): CartItem[] {
  if (!Array.isArray(input) || input.length === 0 || input.some((item) =>
    !item || typeof item !== 'object' || !Number.isSafeInteger(item.id) ||
    !Number.isSafeInteger(item.qty) || item.qty < 1
  )) {
    throw new OrderPricingError('Add at least one valid saree to your bag before ordering.');
  }
  return input.map((item) => ({ id: item.id, qty: item.qty, finish: item.finish }));
}

// Keep the price at purchase time in the existing JSON column; no schema migration is needed.
export function serializeOrderQuote(quote: OrderQuote): string {
  return JSON.stringify({ version: 1, ...quote });
}

export function readOrderSnapshot(json: string): { items: OrderItem[]; pricing?: OrderPricing } {
  try {
    const stored = JSON.parse(json);
    // Orders created before coupon support stored only an array of items.
    if (Array.isArray(stored)) return { items: stored };
    if (stored && Array.isArray(stored.items)) {
      return { items: stored.items, pricing: stored.pricing };
    }
  } catch {
    // A malformed legacy record should not prevent the order list from loading.
  }
  return { items: [] };
}
