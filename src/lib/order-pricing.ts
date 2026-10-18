import { getCatalogue } from '@/lib/catalogue-server';
import { getCommerce } from '@/lib/commerce-server';
import { quoteFromCatalogue } from '@/lib/pricing';
import type { CartItem, OrderQuote } from '@/types';
export { OrderPricingError, parseOrderItems, readOrderSnapshot, serializeOrderQuote } from '@/lib/pricing';

// Authoritative orders always use a fresh server read, never browser prices.
export async function calculateOrderQuote(items: CartItem[], code?: string | null): Promise<OrderQuote> {
  const [catalogue, commerce] = await Promise.all([getCatalogue(), getCommerce()]);
  return quoteFromCatalogue(items, code, catalogue.products, true, commerce);
}
