import { expect, test } from 'bun:test';
import { parseOrderItems, quoteFromCatalogue } from '../src/lib/pricing.ts';
import { toPublicTrackedOrder, withLineImages } from '../src/lib/order-lookup.ts';

const catalogue = [
  { id: 10, name: 'QA', type: 'Silk', collection: 'Silk', price: 1000, oldPrice: null, colour: 'maroon', stock: 5, tag: '', image: '/cover.webp', images: ['/cover.webp'], description: '',
    variants: [
      { name: 'maroon', colour: 'maroon', images: ['/maroon.webp'] },
      { name: 'Gold', colour: 'Gold', images: ['/assets/saree-ivory.webp'] },
    ] },
  { id: 2, name: 'Plain', type: 'Silk', collection: 'Silk', price: 500, oldPrice: null, colour: 'Rose', stock: 5, tag: '', image: '/rose.webp', description: '' },
];

test('client-supplied image URLs are dropped; images come from the server catalogue', () => {
  const items = parseOrderItems([{ id: 10, qty: 1, variant: 'gold', image: 'https://evil.example/x.png' }, { id: 2, qty: 1, image: 'javascript:alert(1)' }]);
  expect(items.every((item) => !('image' in item))).toBe(true);
  const quote = quoteFromCatalogue(items, null, catalogue);
  expect(quote.items[0].image).toBe('/assets/saree-ivory.webp');
  expect(quote.items[0].variant).toBe('Gold');
  expect(quote.items[1].image).toBe('/rose.webp');
  expect(quote.items[0].unitPrice).toBe(1000);
});

test('unknown variants are not stored', () => {
  const quote = quoteFromCatalogue(parseOrderItems([{ id: 10, qty: 1, variant: '<script>' }]), null, catalogue);
  expect(quote.items[0].variant).toBeUndefined();
  expect(quote.items[0].image).toBe('/maroon.webp');
});

test('older orders without image or variant still get a thumbnail, missing products are left as-is', () => {
  const items = withLineImages([{ id: 2, qty: 1 }, { id: 999, qty: 1 }], catalogue);
  expect(items[0].image).toBe('/rose.webp');
  expect(items[1].image).toBeUndefined();
});

test('public tracking line items expose display fields only', () => {
  const tracked = toPublicTrackedOrder({
    id: 'VRN-1', total: 1000, status: 'Confirmed',
    itemsJson: JSON.stringify({ version: 1, items: [{ id: 10, qty: 1, name: 'QA', finish: 'x', secret: 'nope', unitPrice: 1000, subtotal: 1000, discountAmount: 0, total: 1000 }], pricing: { subtotal: 1000, discountAmount: 0, shipping: 0, total: 1000 } }),
  }, catalogue);
  expect(tracked.items[0]).toEqual({ id: 10, qty: 1, name: 'QA', image: '/maroon.webp', unitPrice: 1000, subtotal: 1000, discountAmount: 0, total: 1000 });
});
