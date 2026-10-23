import { afterAll, afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { DEFAULT_SETTINGS } from '../src/lib/commerce.ts';
import { deliveryPolicyText } from '../src/lib/delivery-policy.ts';
import { getSiteUrl } from '../src/lib/site-url.ts';
import { loadTrackedOrder, toPublicTrackedOrder } from '../src/lib/order-lookup.ts';
import { isTestProduct } from '../src/lib/test-product.ts';
import { getArticle, withArticle } from '../src/lib/article.ts';

const originalSiteUrl = process.env.SITE_URL;
const originalNextPublic = process.env.NEXT_PUBLIC_SITE_URL;
const originalVercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const originalFetch = globalThis.fetch;
let rows, unavailable;
mock.module('../src/db/index.ts', () => ({ db: {
  select: () => ({ from: () => ({ orderBy: async () => {
    if (unavailable) throw new Error('Database unavailable');
    return structuredClone(rows);
  } }) }),
} }));
const { default: ProductPage, generateMetadata } = await import('../src/app/product/[id]/page.tsx');
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
  if (originalNextPublic === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = originalNextPublic;
  if (originalVercelProd === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL; else process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelProd;
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
  expect(entries.some((entry) => entry.url === 'https://store.example.test/product/9')).toBe(false);
  expect(entries.some((entry) => entry.url === 'https://store.example.test/product/10')).toBe(false);
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

test('public origin handles fallback sequence, bad settings safely and never returns localhost', () => {
  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

  for (const value of ['', ' ', 'bad url', 'javascript:alert(1)', 'ftp://example.test', 'http://localhost:3000', 'http://127.0.0.1:3000']) {
    process.env.SITE_URL = value;
    expect(getSiteUrl().href).toBe('https://varnam-saree.vercel.app/');
  }

  process.env.SITE_URL = 'https://user:password@example.test/store?query=1';
  expect(getSiteUrl().href).toBe('https://example.test/');

  // Falls back to NEXT_PUBLIC_SITE_URL when SITE_URL is localhost or missing
  process.env.SITE_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://public.example.test';
  expect(getSiteUrl().href).toBe('https://public.example.test/');

  // Falls back to VERCEL_PROJECT_PRODUCTION_URL when preceding are unset or localhost
  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'varnam-preview.vercel.app';
  expect(getSiteUrl().href).toBe('https://varnam-preview.vercel.app/');

  // Final fallback is varnam-saree.vercel.app
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  expect(getSiteUrl().href).toBe('https://varnam-saree.vercel.app/');
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

test('isTestProduct correctly identifies test and QA products', () => {
  expect(isTestProduct({ id: 9, name: 'Normal name' })).toBe(true);
  expect(isTestProduct({ id: 10, name: 'Normal name' })).toBe(true);
  expect(isTestProduct({ id: '9', name: 'Normal name' })).toBe(true);
  expect(isTestProduct({ id: '10', name: 'Normal name' })).toBe(true);
  expect(isTestProduct({ id: 1, name: 'QA emerald saree' })).toBe(true);
  expect(isTestProduct({ id: 2, name: 'qa soft silk' })).toBe(true);
  expect(isTestProduct({ id: 3, name: 'Test banarasi saree' })).toBe(true);
  expect(isTestProduct({ id: 4, name: 'test festive saree' })).toBe(true);
  expect(isTestProduct({ id: 5, name: 'Sample cotton saree' })).toBe(true);
  expect(isTestProduct({ id: 6, name: 'sample silk' })).toBe(true);
  expect(isTestProduct({ id: 1, name: 'Mayil emerald silk saree' })).toBe(false);
  expect(isTestProduct(null)).toBe(false);
  expect(isTestProduct(undefined)).toBe(false);
});

test('article helper chooses a or an before colour strings', () => {
  expect(getArticle('emerald')).toBe('an');
  expect(getArticle('Emerald')).toBe('an');
  expect(getArticle('ivory')).toBe('an');
  expect(getArticle('indigo')).toBe('an');
  expect(getArticle('orange')).toBe('an');
  expect(getArticle('rose')).toBe('a');
  expect(getArticle('gold')).toBe('a');
  expect(getArticle('maroon')).toBe('a');
  expect(getArticle('')).toBe('a');
  expect(getArticle(null)).toBe('a');

  expect(withArticle('emerald')).toBe('an emerald');
  expect(withArticle('ivory')).toBe('an ivory');
  expect(withArticle('rose')).toBe('a rose');
});

test('product 404 calls notFound() for missing id and generateMetadata does not crash', async () => {
  // generateMetadata should not crash for missing or invalid ids
  const missingMeta = await generateMetadata({ params: Promise.resolve({ id: '999' }) });
  expect(missingMeta.title).toBe('Saree not found | Varnam');
  expect(missingMeta.robots).toEqual({ index: false, follow: false });

  const invalidMeta = await generateMetadata({ params: Promise.resolve({ id: 'invalid-id' }) });
  expect(invalidMeta.title).toBe('Saree not found | Varnam');

  // ProductPage throws when id does not exist
  await expect(ProductPage({ params: Promise.resolve({ id: '999' }) })).rejects.toThrow();
  await expect(ProductPage({ params: Promise.resolve({ id: 'invalid-id' }) })).rejects.toThrow();
});

