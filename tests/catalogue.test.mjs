import { beforeEach, afterAll, expect, mock, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };
let rows, unavailable, savedOrders, updates;
const sample = () => ({ id: 101, name: 'Studio-edited silk', type: 'Handloom silk', collection: 'Wedding', price: 4000, oldPrice: 5000, colour: 'Plum', stock: 3, tag: 'New arrival', image: '/assets/saree-rose.webp', description: 'Description saved by Studio.' });
mock.module('../src/db/index.ts', () => ({ db: {
  select: () => ({ from: () => ({ orderBy: async () => {
    if (unavailable) throw new Error('Database unavailable');
    return structuredClone(rows);
  } }) }),
  update: () => ({ set: (values) => ({ where: () => ({ returning: async () => {
    rows[0] = { ...rows[0], ...values }; updates++; return [rows[0]];
  } }) }) }),
  insert: () => ({ values: (value) => ({ returning: async () => {
    savedOrders.push(value); return [value];
  } }) }),
} }));

const { getCatalogue } = await import('../src/lib/catalogue-server.ts');
const { calculateOrderQuote } = await import('../src/lib/order-pricing.ts');
const { quoteFromCatalogue, previewOrderQuote, readOrderSnapshot } = await import('../src/lib/pricing.ts');
const { fallbackProducts } = await import('../src/data/products.ts');
const { GET } = await import('../src/app/api/products/route.ts');
const { POST: submitOrder } = await import('../src/app/api/orders/route.ts');
const { PATCH: editProduct } = await import('../src/app/api/admin/products/[id]/route.ts');
const { createAdminSession, ADMIN_SESSION_COOKIE } = await import('../src/lib/admin-session.ts');
const { filterShopProducts, getShopFilterOptions, createShopFilters } = await import('../src/lib/shop-filters.ts');
const items = [{ id: 101, qty: 1, finish: 'Included' }];

beforeEach(() => {
  rows = [sample()]; unavailable = false; savedOrders = []; updates = 0;
  process.env.ADMIN_LOGIN_EMAIL = randomBytes(12).toString('hex') + '@example.test';
  process.env.ADMIN_LOGIN_PASSWORD = randomBytes(32).toString('hex');
});
afterAll(() => {
  for (const key of ['ADMIN_LOGIN_EMAIL', 'ADMIN_LOGIN_PASSWORD']) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
  mock.restore();
});

test('public catalogue and server quote use the same DB price, description, stock and custom collection', async () => {
  const response = await GET();
  expect(response.headers.get('cache-control')).toBe('no-store');
  const catalogue = await response.json();
  expect(catalogue.source).toBe('database');
  expect(catalogue.products).toEqual(rows);
  const quote = await calculateOrderQuote(items, 'OFFER50');
  expect(quote.items[0].unitPrice).toBe(4000);
  expect(quote.pricing.total).toBe(2000);
  const options = getShopFilterOptions(catalogue.products);
  expect(options.collections).toContain('Wedding');
  expect(filterShopProducts(catalogue.products, createShopFilters(options.priceBounds, 'Wedding'), 'plum')).toHaveLength(1);
});

test('an authenticated Studio price edit changes both storefront API and authoritative pricing', async () => {
  const request = new NextRequest('http://localhost/api/admin/products/101', { method: 'PATCH', headers: { cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession()}`, 'content-type': 'application/json' }, body: JSON.stringify({ price: 6000, description: 'Updated in Studio.' }) });
  const response = await editProduct(request, { params: Promise.resolve({ id: '101' }) });
  expect(response.status).toBe(200); expect(updates).toBe(1);
  const catalogue = await (await GET()).json();
  expect(catalogue.products[0].price).toBe(6000);
  expect(catalogue.products[0].description).toBe('Updated in Studio.');
  const quote = await calculateOrderQuote(items, 'OFFER50');
  expect(quote.items[0].unitPrice).toBe(6000);
  expect(quote.pricing.total).toBe(3000);
});

test.each(['empty', 'unreachable'])('%s DB uses the same non-empty fallback in storefront and pricing', async (mode) => {
  if (mode === 'empty') rows = []; else unavailable = true;
  const catalogue = await getCatalogue();
  expect(catalogue.source).toBe('fallback');
  expect(catalogue.products).toEqual(fallbackProducts);
  const quote = await calculateOrderQuote([{ id: fallbackProducts[0].id, qty: 1, finish: 'Included' }]);
  expect(quote.items[0].unitPrice).toBe(catalogue.products[0].price);
});

test('a non-empty database never merges fallback IDs or replaces a sold-out catalogue', async () => {
  rows[0].stock = 0;
  expect((await getCatalogue()).source).toBe('database');
  expect((await getCatalogue()).products).toHaveLength(1);
  await expect(calculateOrderQuote([{ id: 1, qty: 1, finish: 'Included' }])).rejects.toThrow('unavailable');
  await expect(calculateOrderQuote(items)).rejects.toThrow('sold out');
});

test('stock limits include duplicate lines, and saved bags show an error without crashing', async () => {
  await expect(calculateOrderQuote([{ ...items[0], qty: 4 }])).rejects.toThrow('Only 3');
  await expect(calculateOrderQuote([{ ...items[0], qty: 2 }, { ...items[0], qty: 2 }])).rejects.toThrow('Only 3');
  expect((await calculateOrderQuote([{ ...items[0], qty: 3 }])).items[0].qty).toBe(3);
  const preview = previewOrderQuote([{ ...items[0], qty: 4 }], 'OFFER50', rows);
  expect(preview.error).toContain('Only 3'); expect(preview.quote.items[0].unitPrice).toBe(4000);
  rows[0].stock = 0;
  expect(previewOrderQuote(items, null, rows).error).toContain('sold out');
  expect(previewOrderQuote(items, null, []).error).toContain('unavailable');
});

test('unknown fallback stock is supported; coupons, delivery threshold and rounding remain consistent', () => {
  const catalogue = [{ ...sample(), price: 2491, stock: undefined }, { ...sample(), id: 102, price: 3291, stock: undefined }];
  const one = quoteFromCatalogue(items, 'OFFER50', catalogue);
  expect(one.pricing).toEqual({ subtotal: 2491, discountAmount: 1246, shipping: 150, total: 1395, couponCode: 'OFFER50', discountPercentage: 50 });
  expect(quoteFromCatalogue(items, 'WELCOME10', catalogue).pricing.discountAmount).toBe(249);
  expect(() => quoteFromCatalogue(items, 'INVALID', catalogue)).toThrow('invalid');
  const both = quoteFromCatalogue([...items, { id: 102, qty: 1, finish: 'Included' }], 'OFFER50', catalogue);
  expect(both.pricing.shipping).toBe(0);
  expect(both.items.reduce((sum, item) => sum + item.total, 0)).toBe(both.pricing.total);
});

test('order API ignores client prices, saves current DB prices, and preserves the purchase snapshot', async () => {
  const req = new NextRequest('http://localhost/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items, total: 1, couponCode: 'OFFER50' }) });
  const response = await submitOrder(req);
  expect(response.status).toBe(200);
  expect(savedOrders[0].total).toBe(2000);
  rows[0].price = 9000;
  expect(readOrderSnapshot(savedOrders[0].itemsJson).items[0].unitPrice).toBe(4000);
});

test('stale displayed total and sold-out/over-limit direct requests cannot create orders', async () => {
  const req = (body) => new NextRequest('http://localhost/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  expect((await submitOrder(req({ items, expectedTotal: 1 }))).status).toBe(409);
  rows[0].stock = 0;
  expect((await submitOrder(req({ items }))).status).toBe(400);
  rows[0].stock = 1;
  expect((await submitOrder(req({ items: [{ ...items[0], qty: 2 }] }))).status).toBe(400);
  expect(savedOrders).toHaveLength(0);
});

test('Studio rejects negative stock and invalid prices before saving', async () => {
  for (const body of [{ stock: -1 }, { stock: 1.5 }, { price: 0 }, { price: 'invalid' }]) {
    const req = new NextRequest('http://localhost/api/admin/products/101', { method: 'PATCH', headers: { cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession()}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await editProduct(req, { params: Promise.resolve({ id: '101' }) })).status).toBe(400);
  }
  expect(updates).toBe(0);
});
