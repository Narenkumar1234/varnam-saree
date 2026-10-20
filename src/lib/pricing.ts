import { validateCoupon } from '@/lib/coupons';
import { DEFAULT_COMMERCE, deliveryCharge, type CommerceConfig } from '@/lib/commerce';
import { getProductQuantityLimit } from '@/lib/product-quantity';
import type { CartItem, OrderItem, OrderPricing, OrderQuote, OrderPayment, Product } from '@/types';

export class OrderPricingError extends Error {}

export function quoteFromCatalogue(items: CartItem[], code: string | null | undefined, catalogue: Product[], checkStock = true, commerce: CommerceConfig = DEFAULT_COMMERCE): OrderQuote {
  const quantities = new Map<number, number>();
  for (const item of items) quantities.set(item.id, (quantities.get(item.id) || 0) + item.qty);
  const pricedItems = items.map((item) => {
    const product = catalogue.find((entry) => entry.id === item.id);
    if (!product || !Number.isSafeInteger(item.qty) || item.qty < 1) {
      throw new OrderPricingError('Your bag contains an unavailable saree or an invalid quantity.');
    }
    if (!Number.isSafeInteger(product.price) || product.price < 1) throw new OrderPricingError('This saree has an invalid price. Please contact Varnam.');
    if (checkStock && product.stock == null && (quantities.get(product.id) || 0) > getProductQuantityLimit(product)) {
      throw new OrderPricingError(`Choose no more than ${getProductQuantityLimit(product)} of ${product.name} per order while availability is unconfirmed.`);
    }
    if (checkStock && product.stock != null) {
      if (product.stock <= 0) throw new OrderPricingError(`${product.name} is sold out. Please remove it before ordering.`);
      if ((quantities.get(product.id) || 0) > product.stock) throw new OrderPricingError(`Only ${product.stock} of ${product.name} are available. Please reduce the quantity.`);
    }
    const subtotal = product.price * item.qty;
    if (!Number.isSafeInteger(subtotal) || subtotal > 2_147_483_497) {
      throw new OrderPricingError('The selected quantity is too large. Please reduce it.');
    }
    return {
      id: product.id,
      qty: item.qty,
      ...(typeof item.finish === 'string' ? { finish: item.finish } : {}),
      name: product.name,
      unitPrice: product.price,
      subtotal,
      discountAmount: 0,
      total: subtotal,
    };
  });

  const subtotal = pricedItems.reduce((sum, item) => sum + item.subtotal, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal > 2_147_483_497) {
    throw new OrderPricingError('The order total is too large. Please reduce the quantity.');
  }
  const validation = code ? validateCoupon(code, commerce.coupons, subtotal) : null;
  if (validation && !validation.valid) throw new OrderPricingError(validation.error);
  const coupon = validation?.valid ? validation.coupon : undefined;
  for (const item of pricedItems) item.discountAmount = Math.floor(item.subtotal * (coupon?.percentage || 0) / 100);
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

  const shipping = deliveryCharge(subtotal, commerce.settings);
  if (!Number.isSafeInteger(subtotal - discountAmount + shipping) || subtotal - discountAmount + shipping > 2_147_483_647) throw new OrderPricingError('The order total is too large. Please reduce the quantity.');
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
  return input.map((item) => sanitizeLineItem({ id: item.id, qty: item.qty, finish: item.finish }));
}

/** Keep string finishing from old bags/orders; drop objects/numbers so the UI cannot crash. */
export function sanitizeLineItem<T extends { finish?: unknown }>(item: T): T & { finish?: string } {
  if (typeof item.finish === 'string') return item as T & { finish?: string };
  const { finish: _ignored, ...rest } = item;
  return rest as T & { finish?: string };
}

// Keep the price at purchase time in the existing JSON column; no schema migration is needed.
export function serializeOrderQuote(quote: OrderQuote): string {
  return JSON.stringify({ version: 1, ...quote });
}

export function readOrderSnapshot(json: string): { items: OrderItem[]; pricing?: OrderPricing; payment?: OrderPayment } {
  try {
    const stored = JSON.parse(json);
    // Orders created before coupon support stored only an array of items.
    if (Array.isArray(stored)) return { items: stored.map(sanitizeLineItem) };
    if (stored && Array.isArray(stored.items)) {
      return { items: stored.items.map(sanitizeLineItem), pricing: stored.pricing, ...(stored.payment ? { payment: stored.payment } : {}) };
    }
  } catch {
    // A malformed legacy record should not prevent the order list from loading.
  }
  return { items: [] };
}

// Keep current prices visible in a saved bag, while preventing unavailable orders.
export function previewOrderQuote(items: CartItem[], code: string | null | undefined, catalogue: Product[], commerce: CommerceConfig = DEFAULT_COMMERCE) {
  try { return { quote: quoteFromCatalogue(items, code, catalogue, true, commerce), error: null }; }
  catch (error) {
    let quote: OrderQuote;
    try { quote = quoteFromCatalogue(items.filter((item) => catalogue.some((p) => p.id === item.id)), null, catalogue, false, commerce); }
    catch { quote = quoteFromCatalogue([], null, catalogue, false, commerce); }
    return { quote, error: error instanceof Error ? error.message : 'Please review your bag before ordering.' };
  }
}
