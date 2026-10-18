import { getCatalogue } from '@/lib/catalogue-server';
import { quoteFromCatalogue } from '@/lib/pricing';
import type { CartItem, OrderQuote } from '@/types';
export { OrderPricingError, parseOrderItems, readOrderSnapshot, serializeOrderQuote } from '@/lib/pricing';

// Authoritative orders always use a fresh server read, never browser prices.
export async function calculateOrderQuote(items: CartItem[], code?: string | null): Promise<OrderQuote> {
  const catalogue = await getCatalogue();
  return quoteFromCatalogue(items, code, catalogue.products);
}
