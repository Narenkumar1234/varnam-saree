import { afterEach, expect, test } from 'bun:test';
import { VARNAM_CONFIG } from '../src/data/products.ts';
import { createProductWhatsAppMessage, createWhatsAppOrderUrl, openWhatsAppOrder } from '../src/lib/whatsapp.ts';
import { getProductQuantityLimit, UNKNOWN_STOCK_MAX_QUANTITY } from '../src/lib/product-quantity.ts';
import { previewOrderQuote, quoteFromCatalogue } from '../src/lib/pricing.ts';

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
