import { afterEach, expect, test } from 'bun:test';
import { VARNAM_CONFIG } from '../src/data/products.ts';
import { createProductWhatsAppMessage, createWhatsAppOrderUrl, openWhatsAppOrder } from '../src/lib/whatsapp.ts';
import { getProductQuantityLimit, UNKNOWN_STOCK_MAX_QUANTITY } from '../src/lib/product-quantity.ts';
import { parseOrderItems, previewOrderQuote, quoteFromCatalogue, readOrderSnapshot } from '../src/lib/pricing.ts';
import { readFileSync } from 'node:fs';

const previousWindow = globalThis.window;
const previousNumber = VARNAM_CONFIG.whatsappNumber;
afterEach(() => {
  if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  VARNAM_CONFIG.whatsappNumber = previousNumber;
});
const product = { id: 1, name: 'மயில் & Rose saree', type: 'Silk', collection: 'Festive', colour: 'Rose', price: 4000, tag: '', image: '/assets/saree-rose.webp' };
const line = (qty) => ({ id: 1, qty, finish: 'Included' });

test('WhatsApp uses synchronous same-tab navigation with the exact encoded message, without opening a popup', () => {
  const assigned = [];
  globalThis.window = { location: { assign: (url) => assigned.push(url) }, open: () => { throw new Error('Popup must not be used'); } };
  const message = createProductWhatsAppMessage(product, { quantity: 2, finish: 'Fall & edging', origin: 'https://varnam.example' });
  expect(openWhatsAppOrder(message)).toBe(true);
  expect(assigned).toEqual([createWhatsAppOrderUrl(message)]);
  expect(new URL(assigned[0]).searchParams.get('text')).toBe(message);
  expect(message).toContain('மயில் & Rose saree × 2');
  expect(message).toContain('Product total: ₹8,000');
  expect(message).not.toContain('Finishing:');
  expect(message).not.toContain('Fall & edging');
});

test('failed navigation, SSR and an unconfigured number report failure instead of claiming a window opened', () => {
  globalThis.window = { location: { assign: () => { throw new Error('Navigation refused'); } } };
  expect(openWhatsAppOrder('Message')).toBe(false);
  delete globalThis.window;
  expect(openWhatsAppOrder('Message')).toBe(false);
  VARNAM_CONFIG.whatsappNumber = '';
  expect(createWhatsAppOrderUrl('Message')).toBeNull();
  expect(openWhatsAppOrder('Message')).toBe(false);
});

test('unknown-stock limits cover null/undefined stock, cumulative lines and the cart preview', () => {
  expect(getProductQuantityLimit(product)).toBe(UNKNOWN_STOCK_MAX_QUANTITY);
  expect(getProductQuantityLimit({ stock: null })).toBe(10);
  expect(quoteFromCatalogue([line(10)], null, [product]).items[0].qty).toBe(10);
  expect(() => quoteFromCatalogue([line(11)], null, [product])).toThrow('no more than 10');
  expect(() => quoteFromCatalogue([line(6), line(5)], null, [product])).toThrow('no more than 10');
  const preview = previewOrderQuote([line(11)], null, [product]);
  expect(preview.error).toContain('availability is unconfirmed');
  expect(preview.quote.pricing.total).toBe(44000);
});

test('known-stock products retain their actual stock cap and sold-out checks', () => {
  expect(getProductQuantityLimit({ stock: 2 })).toBe(2);
  expect(getProductQuantityLimit({ stock: 0 })).toBe(0);
  expect(() => quoteFromCatalogue([line(3)], null, [{ ...product, stock: 2 }])).toThrow('Only 2');
  expect(() => quoteFromCatalogue([line(1)], null, [{ ...product, stock: 0 }])).toThrow('sold out');
  expect(quoteFromCatalogue([line(12)], null, [{ ...product, stock: 20 }]).items[0].qty).toBe(12);
});

test('invalid quantities, bad prices and oversized quotations produce a safe preview and visible error text', () => {
  for (const qty of [NaN, Infinity, 0, -1, 1.5]) {
    const preview = previewOrderQuote([line(qty)], null, [product]);
    expect(preview.error).toContain('invalid quantity');
    expect(preview.quote.pricing.total).toBe(0);
  }
  expect(previewOrderQuote([line(1)], null, [{ ...product, price: 0 }]).error).toContain('invalid price');
  const overflow = previewOrderQuote([line(2)], null, [{ ...product, price: 2_000_000_000, stock: 2 }]);
  expect(overflow.error).toContain('quantity is too large');
  expect(overflow.quote.pricing.total).toBe(0);
});

test('orders and bags still load when old stitching fields are missing or not a string', () => {
  expect(parseOrderItems([{ id: 1, qty: 2 }])).toEqual([{ id: 1, qty: 2 }]);
  expect(parseOrderItems([{ id: 1, qty: 2, finish: { bust: 36, waist: 30 } }])).toEqual([{ id: 1, qty: 2 }]);
  expect(quoteFromCatalogue([{ id: 1, qty: 1 }], null, [product]).items[0].finish).toBeUndefined();
  expect(quoteFromCatalogue([{ id: 1, qty: 1, finish: 'Included' }], null, [product]).items[0].finish).toBe('Included');
  expect(quoteFromCatalogue([{ id: 1, qty: 1, finish: { bust: 36 } }], null, [product]).pricing.total).toBe(4000);

  const legacy = readOrderSnapshot(JSON.stringify({
    version: 1,
    items: [{ id: 1, qty: 1, name: 'Silk', finish: { measurements: { bust: 36 } }, total: 4000 }],
    pricing: { subtotal: 4000, discountAmount: 0, shipping: 0, total: 4000 },
  }));
  expect(legacy.items[0].finish).toBeUndefined();
  expect(legacy.items[0].total).toBe(4000);
});

test('product, bag and checkout no longer offer blouse stitching', () => {
  const detail = readFileSync(new URL('../src/components/ProductDetail.tsx', import.meta.url), 'utf8');
  const cart = readFileSync(new URL('../src/app/cart/page.tsx', import.meta.url), 'utf8');
  const checkout = readFileSync(new URL('../src/app/checkout/page.tsx', import.meta.url), 'utf8');
  expect(detail).toContain('Includes unstitched blouse piece');
  expect(detail).not.toContain('Choose finishing');
  expect(detail).not.toContain('Fall & edging');
  expect(cart).not.toContain('Unstitched blouse');
  expect(cart).not.toContain('item.finish');
  expect(checkout).not.toContain('buyNowFinish');
  expect(checkout).not.toContain("searchParams.get('finish')");
});
