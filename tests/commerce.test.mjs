import { beforeEach, afterAll, expect, mock, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DEFAULT_COUPONS, DEFAULT_SETTINGS, COUPONS_INITIALIZED, renderMarquee } from '../src/lib/commerce.ts';

const previousEnv = { ...process.env };
let tables, failures, calls;
const dialect = new PgDialect();
const rowId = (where) => dialect.sqlToQuery(where).params[0];
const result = (execute) => ({ then: (resolve, reject) => Promise.resolve().then(execute).then(resolve, reject), orderBy() { return this; }, returning: () => Promise.resolve().then(execute) });
const db = {
  select: () => ({ from: (table) => result(() => {
    calls++;
    const name = getTableName(table);
    if (failures.has(name)) throw new Error('Database unreachable');
    return structuredClone(tables[name]);
  }) }),
  insert: (table) => ({ values: (input) => {
    let conflict = 'error', changes;
    const query = result(() => {
      calls++; const name = getTableName(table); if (failures.has(name)) throw new Error('Database unreachable');
      const added = [];
      for (const value of Array.isArray(input) ? input : [input]) {
        const key = name === 'site_settings' ? 'key' : name === 'coupons' ? 'code' : 'id';
        const existing = tables[name].find((row) => row[key] === value[key]);
        if (existing) {
          if (conflict === 'nothing') continue;
          if (conflict === 'update') { Object.assign(existing, changes); added.push(existing); continue; }
          throw Object.assign(new Error('duplicate key'), { code: '23505' });
        }
        const row = { ...(name === 'coupons' ? { id: Math.max(0, ...tables[name].map((r) => r.id)) + 1 } : {}), ...value };
        tables[name].push(row); added.push(row);
      }
      return added;
    });
    query.onConflictDoNothing = () => { conflict = 'nothing'; return query; };
    query.onConflictDoUpdate = ({ set }) => { conflict = 'update'; changes = set; return query; };
    return query;
  } }),
  update: (table) => ({ set: (value) => ({ where: (condition) => result(() => {
    calls++; const name = getTableName(table); const id = rowId(condition);
    const row = tables[name].find((row) => row.id === id);
    if (!row) return [];
    if (tables[name].some((other) => other.id !== id && other.code === value.code)) throw Object.assign(new Error('duplicate key'), { code: '23505' });
    Object.assign(row, value); return [row];
  }) }) }),
  delete: (table) => ({ where: (condition) => result(() => {
    calls++; const name = getTableName(table), id = rowId(condition);
    const removed = tables[name].filter((row) => row.id === id);
    tables[name] = tables[name].filter((row) => row.id !== id); return removed;
  }) }),
  transaction: async (callback) => {
    const before = structuredClone(tables);
    try { return await callback(db); } catch (error) { tables = before; throw error; }
  },
};
mock.module('../src/db/index.ts', () => ({ db }));
const { getCommerce } = await import('../src/lib/commerce-server.ts');
const { calculateOrderQuote } = await import('../src/lib/order-pricing.ts');
const { previewOrderQuote, readOrderSnapshot } = await import('../src/lib/pricing.ts');
const { validateCoupon } = await import('../src/lib/coupons.ts');
const { createAdminSession, ADMIN_SESSION_COOKIE } = await import('../src/lib/admin-session.ts');
const couponRoutes = await import('../src/app/api/admin/coupons/route.ts');
const couponRoute = await import('../src/app/api/admin/coupons/[id]/route.ts');
const settingsRoutes = await import('../src/app/api/admin/settings/route.ts');
const publicConfig = await import('../src/app/api/commerce/route.ts');
const orders = await import('../src/app/api/orders/route.ts');
const { seedCommerce } = await import('../src/db/seed-commerce.ts');
const { getShopFilterOptions, createShopFilters, filterShopProducts } = await import('../src/lib/shop-filters.ts');
const { createProductWhatsAppMessage } = await import('../src/lib/whatsapp.ts');
const items = [{ id: 99, qty: 1, finish: 'Included' }];
const req = (path, method = 'GET', body, authenticated = true, extra = {}) => new NextRequest(`http://localhost${path}`, {
  method, headers: { ...(authenticated ? { cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession()}` } : {}), 'content-type': 'application/json', ...extra },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const context = (id) => ({ params: Promise.resolve({ id: String(id) }) });
const delivery = { customerName: 'Test Customer', email: 'customer@example.test', phone: '9876543210', address: '12 Rose Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' };
const order = (code, expectedTotal) => orders.POST(req('/api/orders', 'POST', { id: 'test-order', items, couponCode: code, expectedTotal, ...delivery }));

beforeEach(() => {
  process.env.ADMIN_LOGIN_EMAIL = `${randomBytes(12).toString('hex')}@example.test`;
  process.env.ADMIN_LOGIN_PASSWORD = randomBytes(32).toString('hex');
  process.env.SQL_HOST = 'localhost';
  tables = {
    coupons: DEFAULT_COUPONS.map((coupon, index) => ({ id: index + 1, ...coupon })),
    site_settings: [...Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value: String(value) })), { key: COUPONS_INITIALIZED, value: 'true' }],
    products: [{ id: 99, name: 'Owner saree', type: 'Linen weave', collection: 'New Linen', price: 4000, colour: 'Peach', stock: 5, image: '/assets/saree-rose.webp' }],
    orders: [],
  };
  failures = new Set(); calls = 0;
});
afterAll(() => {
  for (const key of ['ADMIN_LOGIN_EMAIL', 'ADMIN_LOGIN_PASSWORD', 'SQL_HOST']) {
    if (previousEnv[key] === undefined) delete process.env[key]; else process.env[key] = previousEnv[key];
  }
  mock.restore();
});

test('disabling a coupon through authenticated Studio makes authoritative checkout reject it', async () => {
  expect((await calculateOrderQuote(items, 'OFFER50')).pricing.total).toBe(2000);
  const changed = await couponRoute.PATCH(req('/api/admin/coupons/1', 'PATCH', { ...tables.coupons[0], enabled: false }), context(1));
  expect(changed.status).toBe(200);
  expect((await getCommerce()).coupons[0].enabled).toBe(false);
  const response = await order('OFFER50'); expect(response.status).toBe(400);
  expect((await response.json()).error).toContain('inactive'); expect(tables.orders).toHaveLength(0);
});

test('changing threshold and fee changes public marquee copy, actual delivery, WhatsApp totals and saved quote', async () => {
  expect((await calculateOrderQuote(items)).pricing.shipping).toBe(0);
  expect((await settingsRoutes.PUT(req('/api/admin/settings', 'PUT', { ...DEFAULT_SETTINGS, freeDeliveryThreshold: 4999 }))).status).toBe(200);
  expect((await calculateOrderQuote(items)).pricing.shipping).toBe(150);
  const settings = { ...DEFAULT_SETTINGS, freeDeliveryThreshold: 4999, standardShippingFee: 225, marqueeMessage1: 'Owner dispatch update' };
  expect((await settingsRoutes.PUT(req('/api/admin/settings', 'PUT', settings))).status).toBe(200);
  const config = await (await publicConfig.GET()).json();
  expect(config.settings.freeDeliveryThreshold).toBe(4999);
  expect(renderMarquee(config.settings.marqueeMessage2, config.settings)).toBe('Free delivery on orders above ₹4,999');
  const quote = await calculateOrderQuote(items, 'OFFER50');
  expect(quote.pricing.shipping).toBe(225); expect(quote.pricing.total).toBe(2225);
  expect(createProductWhatsAppMessage(tables.products[0], { pricing: quote.pricing })).toContain('Order total: ₹2,225');
  expect((await order('OFFER50', 2000)).status).toBe(409);
  expect((await order('OFFER50', 2225)).status).toBe(200);
  const saved = readOrderSnapshot(tables.orders[0].itemsJson);
  tables.site_settings.find((row) => row.key === 'standardShippingFee').value = '500';
  expect(saved.pricing.total).toBe(2225);
});

test('coupon expiry and minimum subtotal are checked server-side with inclusive UTC dates', async () => {
  tables.coupons[0].expiresOn = '2000-01-01';
  expect((await order('OFFER50')).status).toBe(400);
  expect((await (await order('OFFER50')).json()).error).toContain('expired');
  tables.coupons[0].expiresOn = null; tables.coupons[0].minSubtotal = 5000;
  expect((await (await order('OFFER50')).json()).error).toContain('minimum order of ₹5,000');
  tables.coupons[0].minSubtotal = 4000;
  expect((await calculateOrderQuote(items, ' offer50 ')).pricing.total).toBe(2000);
  tables.coupons[0].expiresOn = '2026-10-18';
  expect(validateCoupon('OFFER50', tables.coupons, 4000, new Date('2026-10-18T23:59:59Z')).valid).toBe(true);
  expect(validateCoupon('OFFER50', tables.coupons, 4000, new Date('2026-10-19T00:00:00Z')).valid).toBe(false);
});

test('admin coupon create, rename, delete, conflicts and missing IDs work; deleting all does not resurrect defaults', async () => {
  const created = await couponRoutes.POST(req('/api/admin/coupons', 'POST', { code: ' linen20 ', percentage: 20, enabled: true, minSubtotal: 1000 }));
  expect(created.status).toBe(201); const { coupon } = await created.json();
  expect(coupon.code).toBe('LINEN20'); expect((await calculateOrderQuote(items, 'LINEN20')).pricing.total).toBe(3200);
  expect((await couponRoutes.POST(req('/api/admin/coupons', 'POST', coupon))).status).toBe(409);
  expect((await couponRoute.PATCH(req('/api/admin/coupons/3', 'PATCH', { ...coupon, code: 'NEW20' }), context(coupon.id))).status).toBe(200);
  await expect(calculateOrderQuote(items, 'LINEN20')).rejects.toThrow('invalid');
  expect((await calculateOrderQuote(items, 'NEW20')).pricing.total).toBe(3200);
  for (const row of [...tables.coupons]) expect((await couponRoute.DELETE(req(`/api/admin/coupons/${row.id}`, 'DELETE'), context(row.id))).status).toBe(200);
  expect((await getCommerce()).coupons).toEqual([]);
  await seedCommerce(db); expect((await getCommerce()).coupons).toEqual([]);
  expect((await order('OFFER50')).status).toBe(400);
  expect((await couponRoute.DELETE(req('/api/admin/coupons/999', 'DELETE'), context(999))).status).toBe(404);
});

test('all new admin operations reject no cookie, tampered cookie and cross-origin writes before DB calls', async () => {
  const handlers = [[couponRoutes.GET, 'GET'], [couponRoutes.POST, 'POST'], [couponRoute.PATCH, 'PATCH'], [couponRoute.DELETE, 'DELETE'], [settingsRoutes.GET, 'GET'], [settingsRoutes.PUT, 'PUT']];
  for (const [handler, method] of handlers) {
    expect((await handler(req('/api/admin/settings', method, undefined, false), context(1))).status).toBe(401);
    expect((await handler(req('/api/admin/settings', method, undefined, false, { cookie: `${ADMIN_SESSION_COOKIE}=forged` }), context(1))).status).toBe(401);
    if (method !== 'GET') expect((await handler(req('/api/admin/settings', method, {}, true, { origin: 'https://other.example' }), context(1))).status).toBe(403);
  }
  expect(calls).toBe(0);
});

test.each(['empty', 'unreachable'])('%s commercial database returns current fallback settings and coupons', async (mode) => {
  if (mode === 'empty') { tables.coupons = []; tables.site_settings = []; }
  else { failures.add('coupons'); failures.add('site_settings'); }
  expect(await getCommerce()).toEqual({ coupons: DEFAULT_COUPONS, settings: DEFAULT_SETTINGS });
  expect((await calculateOrderQuote(items, 'OFFER50')).pricing.total).toBe(2000);
  expect((await publicConfig.GET()).headers.get('cache-control')).toBe('no-store');
});

test('unavailable admin storage fails visibly instead of claiming to save; malformed settings/coupons are rejected', async () => {
  failures.add('site_settings');
  expect((await settingsRoutes.GET(req('/api/admin/settings'))).status).toBe(503);
  expect((await settingsRoutes.PUT(req('/api/admin/settings', 'PUT', DEFAULT_SETTINGS))).status).toBe(503);
  failures.clear();
  for (const invalid of [{ ...DEFAULT_SETTINGS, freeDeliveryThreshold: -1 }, { ...DEFAULT_SETTINGS, standardShippingFee: 1.5 }, { ...DEFAULT_SETTINGS, marqueeMessage2: 'Free delivery above ₹2,999' }, { ...DEFAULT_SETTINGS, secret: 'no' }]) {
    expect((await settingsRoutes.PUT(req('/api/admin/settings', 'PUT', invalid))).status).toBe(400);
  }
  for (const invalid of [{ ...DEFAULT_COUPONS[0], percentage: 101 }, { ...DEFAULT_COUPONS[0], enabled: 'true' }, { ...DEFAULT_COUPONS[0], minSubtotal: -1 }, { ...DEFAULT_COUPONS[0], expiresOn: '2026-02-30' }]) expect((await couponRoutes.POST(req('/api/admin/coupons', 'POST', invalid))).status).toBe(400);
});

test('new product collection and price bounds come only from live products', () => {
  const options = getShopFilterOptions(tables.products);
  expect(options.collections).toEqual(['All', 'New Linen']); expect(options.priceBounds).toEqual({ min: 4000, max: 4000 });
  expect(filterShopProducts(tables.products, createShopFilters(options.priceBounds, 'New Linen'))).toHaveLength(1);
});

test('free delivery uses above-threshold subtotal, preserves empty-bag totals, and invalid coupons remain removable', async () => {
  tables.products[0].price = 2999;
  expect((await calculateOrderQuote(items)).pricing.shipping).toBe(150);
  tables.products[0].price = 3000;
  expect((await calculateOrderQuote(items, 'OFFER50')).pricing.shipping).toBe(0);
  tables.coupons[0].enabled = false;
  const preview = previewOrderQuote(items, 'OFFER50', tables.products, await getCommerce());
  expect(preview.error).toContain('inactive'); expect(preview.quote.pricing.total).toBe(3000);
  expect(previewOrderQuote([], null, tables.products, await getCommerce()).quote.pricing.total).toBe(0);
  tables.site_settings.find((row) => row.key === 'freeDeliveryThreshold').value = '0';
  expect((await calculateOrderQuote(items)).pricing.shipping).toBe(0);
});
