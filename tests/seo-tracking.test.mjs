import { afterAll, afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { DEFAULT_SETTINGS } from '../src/lib/commerce.ts';
import { deliveryPolicyText } from '../src/lib/delivery-policy.ts';
import { getSiteUrl } from '../src/lib/site-url.ts';
import { loadTrackedOrder, toPublicTrackedOrder } from '../src/lib/order-lookup.ts';

const originalSiteUrl = process.env.SITE_URL;
const originalFetch = globalThis.fetch;
let rows, unavailable;
mock.module('../src/db/index.ts', () => ({ db: {
  select: () => ({ from: () => ({ orderBy: async () => {
    if (unavailable) throw new Error('Database unavailable');
    return structuredClone(rows);
  } }) }),
} }));
const { generateMetadata } = await import('../src/app/product/[id]/page.tsx');
const { default: sitemap } = await import('../src/app/sitemap.ts');
const { default: robots } = await import('../src/app/robots.ts');
const metadata = (id) => generateMetadata({ params: Promise.resolve({ id: String(id) }) });

beforeEach(() => {
  process.env.SITE_URL = 'https://store.example.test';
  unavailable = false;
  rows = [{ id: 101, name: 'Owner rose silk saree', type: 'Handloom silk', collection: 'Wedding', price: 4000, colour: 'Rose', stock: 2, image: '/uploads/rose.webp', description: 'A description written by the owner.' }];
});
afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = originalSiteUrl;
  globalThis.fetch = originalFetch;
});
afterAll(() => mock.restore());

test('product route metadata uses current DB name, description, image and canonical URL', async () => {
  const first = await metadata(101);
  expect(first.title).toBe('Owner rose silk saree | Varnam');
  expect(first.description).toBe(rows[0].description);
  expect(first.openGraph.images).toEqual([{ url: '/uploads/rose.webp', alt: rows[0].name }]);
  expect(first.openGraph.url).toBe('https://store.example.test/product/101');
  expect(first.alternates.canonical).toBe(first.openGraph.url);
  expect(first.twitter.images).toEqual(['/uploads/rose.webp']);
  rows[0].name = 'Edited by Studio'; rows[0].description = 'Updated description'; rows[0].image = 'https://images.example.test/saree.webp';
  const changed = await metadata(101);
  expect(changed.title).toBe('Edited by Studio | Varnam'); expect(changed.description).toBe('Updated description');
  expect(changed.openGraph.images[0].url).toBe(rows[0].image);
});

test('missing descriptions are generated from product details and missing products are noindex', async () => {
  rows[0].description = ' ';
  expect((await metadata(101)).description).toContain('Owner rose silk saree');
  expect((await metadata(101)).description).toContain('Wedding');
  expect((await metadata(999)).robots).toEqual({ index: false, follow: false });
});

test.each(['empty', 'unreachable'])('%s DB supplies fallback product metadata and product sitemap URLs', async (mode) => {
  if (mode === 'empty') rows = []; else unavailable = true;
  expect((await metadata(1)).title).toBe('Mayil emerald silk saree | Varnam');
  expect((await metadata(1)).openGraph.images[0].url).toBe('/assets/saree-emerald.webp');
  const entries = await sitemap();
  expect(entries.some((entry) => entry.url === 'https://store.example.test/product/8')).toBe(true);
});

test('crawler routes use the configured origin and current DB catalogue, omitting private flows', async () => {
  const urls = (await sitemap()).map((entry) => entry.url);
  expect(urls).toContain('https://store.example.test/product/101');
  expect(urls).not.toContain('https://store.example.test/product/1');
  expect(urls).toContain('https://store.example.test/shipping');
  expect(urls.some((url) => /studio-desk|checkout|confirmation|track|account/.test(url))).toBe(false);
  const rules = robots();
  expect(rules.sitemap).toBe('https://store.example.test/sitemap.xml');
  expect(rules.rules.disallow).toContain('/studio-desk'); expect(rules.rules.disallow).toContain('/api/');
});

test('public origin handles blank/malformed/non-HTTP settings safely and removes credentials/paths', () => {
  for (const value of ['', ' ', 'bad url', 'javascript:alert(1)', 'ftp://example.test']) {
    process.env.SITE_URL = value; expect(getSiteUrl().href).toBe('http://localhost:3000/');
  }
  process.env.SITE_URL = 'https://user:password@example.test/store?query=1';
  expect(getSiteUrl().href).toBe('https://example.test/');
});

test('only a confirmed tracking 404 returns no order; connection/server/malformed responses reject', async () => {
  globalThis.fetch = async () => Response.json({ error: 'Not found' }, { status: 404 });
  expect(await loadTrackedOrder('VRN-test')).toBeNull();
  for (const failure of [() => { throw new TypeError('Network failed'); }, () => Response.json({}, { status: 500 }), () => new Response('not JSON'), () => Response.json({}), () => Response.json({ order: { id: 'other', total: 100 } })]) {
    globalThis.fetch = async () => failure();
    await expect(loadTrackedOrder('VRN-test')).rejects.toThrow();
  }
});

test('tracking success preserves order details and supplies no-store caching, URL encoding and abort signal', async () => {
  const id = 'VRN A&B', controller = new AbortController();
  const order = { id, total: 4000, createdAt: '2026-10-18T00:00:00Z' };
  globalThis.fetch = async (url, options) => {
    expect(url).toBe('/api/orders/VRN%20A%26B'); expect(options.cache).toBe('no-store'); expect(options.signal).toBe(controller.signal);
    return Response.json({ order });
  };
  expect(await loadTrackedOrder(id, controller.signal)).toEqual(order);
});

test('tracking lookup keeps payment status and strips Razorpay ids, signatures and itemsJson', async () => {
  const id = 'VRN-pay';
  const secretPayment = {
    provider: 'razorpay', status: 'pending', razorpayOrderId: 'order_secret',
    amount: 400000, currency: 'INR', paymentId: 'pay_secret', razorpay_signature: 'sig_secret',
  };
  globalThis.fetch = async () => Response.json({
    order: {
      id, total: 4000, status: 'Confirmed', createdAt: '2026-10-20T00:00:00Z',
      email: 'hidden@example.test', itemsJson: JSON.stringify({ payment: secretPayment }),
      payment: secretPayment, razorpay_signature: 'sig_secret',
    },
  });
  const tracked = await loadTrackedOrder(id);
  expect(tracked).toEqual({ id, total: 4000, createdAt: '2026-10-20T00:00:00Z', status: 'Confirmed', payment: { status: 'pending', provider: 'razorpay' } });
  expect(JSON.stringify(tracked)).not.toContain('order_secret');
  expect(JSON.stringify(tracked)).not.toContain('pay_secret');
  expect(JSON.stringify(tracked)).not.toContain('sig_secret');
  expect(JSON.stringify(tracked)).not.toContain('hidden@example.test');
  expect(tracked).not.toHaveProperty('itemsJson');
  expect(toPublicTrackedOrder({
    id, total: 4000, status: 'Confirmed',
    itemsJson: JSON.stringify({ version: 1, items: [], pricing: { subtotal: 4000, discountAmount: 0, shipping: 0, total: 4000 }, payment: secretPayment }),
  }).payment).toEqual({ status: 'pending', provider: 'razorpay' });
});

test('delivery policy formats standalone and embedded text with exactly the caller-owned punctuation', () => {
  expect(deliveryPolicyText(DEFAULT_SETTINGS)).toBe('Free delivery on orders above ₹2,999.');
  const text = deliveryPolicyText(DEFAULT_SETTINGS, { includeFee: true, embedded: true });
  expect(`We offer ${text}.`).toBe('We offer free delivery on orders above ₹2,999; otherwise, a ₹150 delivery charge applies.');
  expect(text.endsWith('.')).toBe(false);
  expect(deliveryPolicyText({ ...DEFAULT_SETTINGS, freeDeliveryThreshold: 4999, standardShippingFee: 225 }, { includeFee: true, embedded: true })).toContain('₹4,999; otherwise, a ₹225');
  expect(deliveryPolicyText({ ...DEFAULT_SETTINGS, standardShippingFee: 0 }, { includeFee: true, embedded: true })).toBe('free delivery on all orders');
});
