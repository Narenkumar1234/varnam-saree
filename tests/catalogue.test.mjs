import { beforeEach, afterAll, expect, mock, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { products as productTable } from '../src/db/schema.ts';

const originalEnv = { ...process.env };
let rows, unavailable, savedOrders, updates;
const sample = () => ({ id: 101, name: 'Studio-edited silk', type: 'Handloom silk', collection: 'Wedding', price: 4000, oldPrice: 5000, colour: 'Plum', stock: 3, tag: 'New arrival', image: '/assets/saree-rose.webp', description: 'Description saved by Studio.' });
mock.module('../src/db/index.ts', () => ({ db: {
  select: () => ({ from: (table) => {
    const read = async () => {
      if (unavailable) throw new Error('Database unavailable');
      return table === productTable ? structuredClone(rows) : [];
    };
    return { where: () => ({ then: (resolve, reject) => read().then(resolve, reject) }), orderBy: read, then: (resolve, reject) => read().then(resolve, reject) };
  } }),
  update: () => ({ set: (values) => ({ where: () => ({ returning: async () => {
    rows[0] = { ...rows[0], ...values }; updates++; return [rows[0]];
  } }) }) }),
  insert: (table) => ({ values: (value) => ({ returning: async () => {
    if (table === productTable) {
      const created = { id: rows.length + 101, ...value };
      rows.push(created);
      return [created];
    }
    savedOrders.push(value); return [value];
  } }) }),
} }));

const { getCatalogue } = await import('../src/lib/catalogue-server.ts');
const { calculateOrderQuote } = await import('../src/lib/order-pricing.ts');
const { quoteFromCatalogue, previewOrderQuote, readOrderSnapshot } = await import('../src/lib/pricing.ts');
const { fallbackProducts } = await import('../src/data/products.ts');
const { GET } = await import('../src/app/api/products/route.ts');
const { POST: submitOrder } = await import('../src/app/api/orders/route.ts');
const { POST: createProduct } = await import('../src/app/api/admin/products/route.ts');
const { PATCH: editProduct } = await import('../src/app/api/admin/products/[id]/route.ts');
const { createAdminSession, ADMIN_SESSION_COOKIE } = await import('../src/lib/admin-session.ts');
const { filterShopProducts, getShopFilterOptions, createShopFilters } = await import('../src/lib/shop-filters.ts');
const items = [{ id: 101, qty: 1, finish: 'Included' }];
const delivery = { customerName: 'Test Customer', email: 'customer@example.test', phone: '9876543210', address: '12 Rose Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' };

beforeEach(() => {
  rows = [sample()]; unavailable = false; savedOrders = []; updates = 0;
  process.env.ADMIN_LOGIN_EMAIL = randomBytes(12).toString('hex') + '@example.test';
  process.env.ADMIN_LOGIN_PASSWORD = randomBytes(32).toString('hex');
  process.env.SQL_HOST = 'localhost';
});
afterAll(() => {
  for (const key of ['ADMIN_LOGIN_EMAIL', 'ADMIN_LOGIN_PASSWORD', 'SQL_HOST']) {
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
  const req = new NextRequest('http://localhost/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items, total: 1, couponCode: 'OFFER50', ...delivery }) });
  const response = await submitOrder(req);
  expect(response.status).toBe(200);
  expect(savedOrders[0].total).toBe(2000);
  expect(savedOrders[0].shippingLine1).toBe('12 Rose Street');
  expect(savedOrders[0].shippingPincode).toBe('600001');
  expect(savedOrders[0].shippingPhone).toBe('9876543210');
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

test('the order API rejects an excessive unknown-stock fallback quantity with a clear 400', async () => {
  rows = [];
  const response = await submitOrder(new NextRequest('http://localhost/api/orders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ id: fallbackProducts[0].id, qty: 11, finish: 'Included' }] }),
  }));
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain('no more than 10');
  expect(savedOrders).toHaveLength(0);
});

test('Studio allows creating and editing products with up to 3 images and caps at 3', async () => {
  const adminCookie = `${ADMIN_SESSION_COOKIE}=${createAdminSession()}`;
  const images = ['/assets/saree-emerald.webp', '/assets/saree-rose.webp', '/assets/saree-indigo.webp', '/assets/saree-ivory.webp'];

  // Create product with >3 images, should cap at 3
  const createReq = new NextRequest('http://localhost/api/admin/products', {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Triple image silk',
      type: 'Kanchipuram pure silk',
      collection: 'Silk',
      price: 8500,
      colour: 'Emerald',
      images,
    }),
  });
  const createRes = await createProduct(createReq);
  expect(createRes.status).toBe(200);
  const createdBody = await createRes.json();
  expect(createdBody.success).toBe(true);
  const parsedCreatedImages = JSON.parse(createdBody.product.images);
  expect(parsedCreatedImages).toHaveLength(3);
  expect(parsedCreatedImages).toEqual(images.slice(0, 3));
  expect(createdBody.product.image).toBe(images[0]);

  // Edit product with 2 images
  const patchReq = new NextRequest('http://localhost/api/admin/products/101', {
    method: 'PATCH',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ images: ['/assets/saree-rose.webp', '/assets/saree-ivory.webp'] }),
  });
  const patchRes = await editProduct(patchReq, { params: Promise.resolve({ id: '101' }) });
  expect(patchRes.status).toBe(200);
  const catalogue = await getCatalogue();
  const edited = catalogue.products.find((p) => p.id === 101);
  expect(edited?.images).toEqual(['/assets/saree-rose.webp', '/assets/saree-ivory.webp']);
  expect(edited?.image).toBe('/assets/saree-rose.webp');
});

test('existing single-image products work in catalogue without requiring images array', async () => {
  rows = [sample()];
  const catalogue = await getCatalogue();
  expect(catalogue.products[0].image).toBe('/assets/saree-rose.webp');
  expect(catalogue.products[0].images).toBeUndefined();
});

test('catalogue cover uses Studio images[0] even when the main image column is stale', async () => {
  rows = [{
    ...sample(),
    image: '/assets/saree-rose.webp',
    images: JSON.stringify(['/assets/saree-ivory.webp', '/assets/saree-emerald.webp']),
  }];
  const catalogue = await getCatalogue();
  expect(catalogue.products[0].images[0]).toBe('/assets/saree-ivory.webp');
  expect(catalogue.products[0].image).toBe('/assets/saree-ivory.webp');
});

test('% of offers filter correctly filters products by discount range (10%+, 25%+, 50%+)', () => {
  const products = [
    { ...sample(), id: 1, price: 9000, oldPrice: 10000 }, // 10% discount
    { ...sample(), id: 2, price: 7000, oldPrice: 10000 }, // 30% discount
    { ...sample(), id: 3, price: 4000, oldPrice: 10000 }, // 60% discount
    { ...sample(), id: 4, price: 5000, oldPrice: null },  // no discount
  ];
  const bounds = { min: 4000, max: 9000 };

  expect(filterShopProducts(products, { ...createShopFilters(bounds), minDiscount: 0 })).toHaveLength(4);

  const tenPlus = filterShopProducts(products, { ...createShopFilters(bounds), minDiscount: 10 });
  expect(tenPlus.map((p) => p.id)).toEqual([1, 2, 3]);

  const twentyFivePlus = filterShopProducts(products, { ...createShopFilters(bounds), minDiscount: 25 });
  expect(twentyFivePlus.map((p) => p.id)).toEqual([2, 3]);

  const fiftyPlus = filterShopProducts(products, { ...createShopFilters(bounds), minDiscount: 50 });
  expect(fiftyPlus.map((p) => p.id)).toEqual([3]);
});

test('Studio PATCH allows setting 50% discount and puts product in 50%+ offers zone', async () => {
  rows = [{ ...sample(), id: 101, price: 10000, oldPrice: null }];
  const adminCookie = `${ADMIN_SESSION_COOKIE}=${createAdminSession()}`;

  const patchReq = new NextRequest('http://localhost/api/admin/products/101', {
    method: 'PATCH',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ price: 10000, discountPercentage: 50 }),
  });
  const patchRes = await editProduct(patchReq, { params: Promise.resolve({ id: '101' }) });
  expect(patchRes.status).toBe(200);

  const catalogue = await getCatalogue();
  const product = catalogue.products.find((p) => p.id === 101);
  expect(product).toBeDefined();
  expect(product.oldPrice).toBe(20000);
  expect(product.price).toBe(10000);

  // Offers 50%+ filter matches
  const matching = filterShopProducts(catalogue.products, {
    ...createShopFilters({ min: 1000, max: 20000 }),
    minDiscount: 50,
  });
  expect(matching.map((p) => p.id)).toContain(101);
});

test('6 mock products with 10/20/30/40/50/60% discounts exist and are clearly identifiable as demo set', () => {
  const demoSet = fallbackProducts.filter((p) => p.name.includes('Demo') || p.tag === 'Demo Offer');
  expect(demoSet.length).toBeGreaterThanOrEqual(6);

  const discounts = [10, 20, 30, 40, 50, 60];
  for (const pct of discounts) {
    const found = demoSet.find((p) => {
      const discount = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
      return discount === pct;
    });
    expect(found).toBeDefined();
  }
});

test('capitalizeColour helper capitalizes first letter of colour', async () => {
  const { capitalizeColour } = await import('../src/lib/colour.ts');
  expect(capitalizeColour('emerald')).toBe('Emerald');
  expect(capitalizeColour('rose pink')).toBe('Rose pink');
  expect(capitalizeColour('indigo')).toBe('Indigo');
  expect(capitalizeColour('')).toBe('');
});

test('AddressFields phone pattern regex compiles without error', async () => {
  const { INDIAN_MOBILE_PATTERN } = await import('../src/lib/address-validation.ts');
  expect(() => new RegExp(INDIAN_MOBILE_PATTERN, 'v')).not.toThrow();
  const regex = new RegExp(`^(?:${INDIAN_MOBILE_PATTERN})$`, 'v');
  expect(regex.test('+91 98765 43210')).toBe(true);
  expect(regex.test('9876543210')).toBe(true);
  expect(regex.test('abc')).toBe(false);
});

test('admin products API guards against blob URLs and never persists them (B4)', async () => {
  const adminCookie = `${ADMIN_SESSION_COOKIE}=${createAdminSession()}`;
  const postReq = new NextRequest('http://localhost/api/admin/products', {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Blob Guard Test Saree',
      type: 'Silk',
      collection: 'Wedding',
      price: 5500,
      colour: 'Ruby',
      image: 'blob:http://localhost/temp-uuid',
      images: ['blob:http://localhost/temp-uuid-1', '/assets/saree-emerald.webp', 'blob:http://localhost/temp-uuid-2'],
      variants: [
        { name: 'Ruby Red', colour: 'Ruby', images: ['blob:http://localhost/temp-uuid-3', '/assets/saree-rose.webp'] },
      ],
    }),
  });
  const res = await createProduct(postReq);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.product.image.startsWith('blob:')).toBe(false);
  const parsedImages = JSON.parse(data.product.images);
  expect(parsedImages.some((img) => img.startsWith('blob:'))).toBe(false);
  expect(parsedImages).toContain('/assets/saree-emerald.webp');
  const parsedVariants = JSON.parse(data.product.variants);
  expect(parsedVariants[0].images.some((img) => img.startsWith('blob:'))).toBe(false);
  expect(parsedVariants[0].images).toContain('/assets/saree-rose.webp');

  // PATCH guard
  const patchReq = new NextRequest(`http://localhost/api/admin/products/${data.product.id}`, {
    method: 'PATCH',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      images: ['blob:http://localhost/patch-uuid', '/assets/saree-indigo.webp'],
    }),
  });
  const patchRes = await editProduct(patchReq, { params: Promise.resolve({ id: String(data.product.id) }) });
  expect(patchRes.status).toBe(200);
  const patchData = await patchRes.json();
  const patchedImages = JSON.parse(patchData.product.images);
  expect(patchedImages.some((img) => img.startsWith('blob:'))).toBe(false);
  expect(patchedImages).toEqual(['/assets/saree-indigo.webp']);
});

test('colour variants model allows up to 3 images per variant and preserves single-colour sarees (B5)', async () => {
  const adminCookie = `${ADMIN_SESSION_COOKIE}=${createAdminSession()}`;
  const req = new NextRequest('http://localhost/api/admin/products', {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Multi-Colour Handloom Saree',
      type: 'Kanchipuram pure silk',
      collection: 'Silk',
      price: 8500,
      colour: 'Emerald',
      images: ['/assets/saree-emerald.webp'],
      variants: [
        { name: 'Emerald Green', colour: 'Emerald', images: ['/assets/saree-emerald.webp', '/assets/saree-rose.webp', '/assets/saree-indigo.webp', '/assets/saree-ivory.webp'] },
        { name: 'Ruby Pink', colour: 'Ruby', images: ['/assets/saree-rose.webp'] },
      ],
    }),
  });
  const res = await createProduct(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  const variants = JSON.parse(data.product.variants);
  expect(variants).toHaveLength(2);
  expect(variants[0].name).toBe('Emerald Green');
  // Capped at 3 images per variant
  expect(variants[0].images).toHaveLength(3);
  expect(variants[1].name).toBe('Ruby Pink');
  expect(variants[1].images).toEqual(['/assets/saree-rose.webp']);

  // Single-colour product without variants works as before
  const singleColourReq = new NextRequest('http://localhost/api/admin/products', {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Single Colour Saree',
      type: 'Tussar silk',
      collection: 'Silk',
      price: 6000,
      colour: 'Indigo',
      images: ['/assets/saree-indigo.webp'],
    }),
  });
  const singleRes = await createProduct(singleColourReq);
  expect(singleRes.status).toBe(200);
  const singleData = await singleRes.json();
  expect(singleData.product.variants).toBeNull();
  expect(singleData.product.colour).toBe('Indigo');
});

test('saving an edited product without a variants field keeps its existing variants unchanged', async () => {
  const adminCookie = `${ADMIN_SESSION_COOKIE}=${createAdminSession()}`;
  const existingVariants = [
    { name: 'Emerald Green', colour: 'Emerald', images: ['/assets/saree-emerald.webp', '/assets/saree-rose.webp'] },
    { name: 'Ruby Pink', colour: 'Ruby', images: ['/assets/saree-rose.webp'] },
  ];
  rows[0] = { ...rows[0], variants: JSON.stringify(existingVariants) };

  // Studio no longer sends variants on edit: the PATCH omits the field entirely
  const patchReq = new NextRequest('http://localhost/api/admin/products/101', {
    method: 'PATCH',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ price: 9500, tag: 'Bestseller', colour: 'Emerald' }),
  });
  const patchRes = await editProduct(patchReq, { params: Promise.resolve({ id: '101' }) });
  expect(patchRes.status).toBe(200);
  const patchData = await patchRes.json();
  expect(JSON.parse(patchData.product.variants)).toEqual(existingVariants);
  expect(patchData.product.price).toBe(9500);
});
