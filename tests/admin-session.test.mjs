import { beforeEach, afterAll, expect, mock, test } from 'bun:test';
import { randomBytes, createHmac } from 'node:crypto';
import { readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };
let dbCalls = [], product, order;
function query(rows) {
  return { orderBy() { return this; }, limit() { return Promise.resolve(rows); }, where() { return this; }, then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); } };
}
// Real route handlers and crypto, with a local DB double: no merchant data changes.
mock.module('../src/db/index.ts', () => ({ db: {
  select: () => ({ from: (table) => {
    dbCalls.push('select');
    return query(table === schema.products ? [product] : [order]);
  } }),
  insert: () => ({ values: (values) => ({ returning: async () => {
    dbCalls.push('insert'); product = { id: 1, ...values }; return [product];
  } }) }),
  update: (table) => ({ set: (values) => ({ where: () => ({ returning: async () => {
    dbCalls.push('update');
    if (table === schema.products) { product = { ...product, ...values }; return [product]; }
    order = { ...order, ...values }; return [order];
  } }) }) }),
  delete: () => ({ where: async () => { dbCalls.push('delete'); } }),
} }));

const schema = await import('../src/db/schema.ts');
const session = await import('../src/lib/admin-session.ts');
const auth = await import('../src/app/api/admin/auth/route.ts');
const products = await import('../src/app/api/admin/products/route.ts');
const productById = await import('../src/app/api/admin/products/[id]/route.ts');
const orders = await import('../src/app/api/admin/orders/route.ts');
const orderById = await import('../src/app/api/admin/orders/[id]/route.ts');
const upload = await import('../src/app/api/admin/upload/route.ts');
const publicOrders = await import('../src/app/api/orders/route.ts');
const cookie = (token) => `${session.ADMIN_SESSION_COOKIE}=${token}`;
const request = (url, method = 'GET', body, token, headers = {}) => new NextRequest(`http://localhost:3000${url}`, {
  method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { cookie: cookie(token) } : {}), ...headers },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
const login = (body) => auth.POST(request('/api/admin/auth', 'POST', body));
const credentials = (overrides = {}) => ({ email: process.env.ADMIN_LOGIN_EMAIL, password: process.env.ADMIN_LOGIN_PASSWORD, ...overrides });

beforeEach(() => {
  process.env.ADMIN_LOGIN_EMAIL = randomBytes(12).toString('hex') + '@example.test';
  process.env.ADMIN_LOGIN_PASSWORD = randomBytes(32).toString('hex');
  process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  dbCalls = [];
  product = { id: 1, name: 'Test silk saree', type: 'Silk', collection: 'Silk', colour: 'Rose', price: 2500, stock: 5 };
  order = { id: 'VRN-admin-test', total: 2500, status: 'Confirmed', itemsJson: JSON.stringify({ version: 1, items: [{ id: 1, qty: 1, finish: 'Included' }], pricing: { subtotal: 2500, shipping: 0, discountAmount: 0, total: 2500 } }) };
});
afterAll(() => {
  for (const key of ['ADMIN_LOGIN_EMAIL', 'ADMIN_LOGIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'NODE_ENV']) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
  mock.restore();
});

test.each([
  ['ADMIN_LOGIN_EMAIL', undefined], ['ADMIN_LOGIN_EMAIL', ''], ['ADMIN_LOGIN_EMAIL', '   '],
  ['ADMIN_LOGIN_PASSWORD', undefined], ['ADMIN_LOGIN_PASSWORD', ''], ['ADMIN_LOGIN_PASSWORD', '   '],
])('missing/blank %s fails closed even with a signing secret', async (key, value) => {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
  const response = await login(credentials());
  expect(response.status).toBe(503);
  expect((await response.json()).error).toBe('Admin login is not configured.');
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(session.validAdminSession('anything')).toBe(false);
  expect((await products.GET(request('/api/admin/products'))).status).toBe(401);
});

test.each([
  ['wrong email with correct password', () => credentials({ email: 'other-' + process.env.ADMIN_LOGIN_EMAIL })],
  ['wrong password with correct email', () => credentials({ password: randomBytes(32).toString('hex') })],
  ['email alone', () => ({ email: process.env.ADMIN_LOGIN_EMAIL })],
  ['password alone', () => ({ password: process.env.ADMIN_LOGIN_PASSWORD })],
  ['old passcode payload', () => ({ email: process.env.ADMIN_LOGIN_EMAIL, passcode: process.env.ADMIN_LOGIN_PASSWORD })],
  ['empty body', () => ({})],
  ['non-string email', () => credentials({ email: 1 })],
  ['non-string password', () => credentials({ password: 1 })],
])('%s cannot log in', async (_label, body) => {
  const response = await login(body());
  expect(response.status).toBe(401);
  expect(response.headers.get('set-cookie')).toBeNull();
});

test('valid email and password issue a signed, scoped HttpOnly cookie with no secret in its payload', async () => {
  const response = await login(credentials());
  expect(response.status).toBe(200);
  const issued = response.cookies.get(session.ADMIN_SESSION_COOKIE).value;
  expect(session.validAdminSession(issued)).toBe(true);
  const header = response.headers.get('set-cookie');
  expect(header).toContain('HttpOnly'); expect(header).toContain('SameSite=strict');
  expect(header).toContain('Path=/api/admin'); expect(header).toContain('Max-Age=28800');
  expect(response.headers.get('cache-control')).toBe('no-store');
  const payload = Buffer.from(issued.split('.')[0], 'base64url').toString();
  expect(payload).not.toContain(process.env.ADMIN_LOGIN_EMAIL);
  expect(payload).not.toContain(process.env.ADMIN_LOGIN_PASSWORD);
  expect(payload).not.toContain(process.env.ADMIN_SESSION_SECRET);
  expect((await auth.GET(request('/api/admin/auth', 'GET', undefined, issued))).status).toBe(200);
});

test('production cookie is Secure; development still permits local HTTP login', async () => {
  process.env.NODE_ENV = 'production';
  expect((await login(credentials())).headers.get('set-cookie')).toContain('Secure');
  process.env.NODE_ENV = 'development';
  expect((await login(credentials())).headers.get('set-cookie')).not.toContain('Secure');
});

test('optional signing secret fallback uses domain-separated HMAC, and either rotation invalidates cookies', () => {
  delete process.env.ADMIN_SESSION_SECRET;
  const fallback = session.createAdminSession();
  const [payload, signature] = fallback.split('.');
  const key = createHmac('sha256', process.env.ADMIN_LOGIN_PASSWORD).update('varnam:studio-admin:session:v1').update('\0').update(process.env.ADMIN_LOGIN_PASSWORD).digest();
  expect(createHmac('sha256', key).update(payload).digest('base64url')).toBe(signature);
  expect(session.validAdminSession(fallback)).toBe(true);
  process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex');
  expect(session.validAdminSession(fallback)).toBe(false);
  const explicit = session.createAdminSession();
  process.env.ADMIN_LOGIN_PASSWORD = randomBytes(32).toString('hex');
  expect(session.validAdminSession(explicit)).toBe(false);
  delete process.env.ADMIN_LOGIN_PASSWORD;
  expect(session.validAdminSession(explicit)).toBe(false);
});

test('expiry, future sessions, altered payloads, bad signatures, and storage flags grant no access', () => {
  const now = Date.now();
  const token = session.createAdminSession(now);
  expect(session.validAdminSession(token, now + session.ADMIN_SESSION_SECONDS * 1000)).toBe(false);
  expect(session.validAdminSession(session.createAdminSession(now + 10000), now)).toBe(false);
  const [payload, signature] = token.split('.');
  for (const bad of ['true', 'varnam_studio_auth=true', '', token + '.extra', `${payload}.${randomBytes(32).toString('base64url')}`, `${Buffer.from('{"expiresAt":9999999999}').toString('base64url')}.${signature}`]) {
    expect(session.validAdminSession(bad, now)).toBe(false);
  }
});

test('all exported admin handlers, including any newly added routes, reject anonymous calls before body/DB access', async () => {
  const root = path.resolve('src/app/api/admin');
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
    return nested.flat();
  }
  const files = (await walk(root)).filter((file) => file.endsWith('route.ts') && path.relative(root, file) !== 'auth/route.ts');
  let covered = 0;
  for (const file of files) {
    const handlers = await import(file);
    const url = '/api/admin/' + path.relative(root, path.dirname(file)).replaceAll(path.sep, '/').replaceAll('[id]', '1');
    for (const [method, handler] of Object.entries(handlers)) {
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;
      // An invalid body would fail parsing if the guard were placed too late.
      const req = new NextRequest('http://localhost:3000' + url, { method, ...(method !== 'GET' ? { body: '{invalid' } : {}) });
      const response = await handler(req, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(401);
      expect((await response.json()).error).toBe('Admin authentication required.');
      covered++;
    }
  }
  expect(covered).toBe(13);
  expect(dbCalls).toHaveLength(0);
});

test('valid session permits inventory listing, create/edit/stock/delete, and dispatch updates', async () => {
  const token = (await login(credentials())).cookies.get(session.ADMIN_SESSION_COOKIE).value;
  const productList = await products.GET(request('/api/admin/products', 'GET', undefined, token));
  expect((await productList.json()).products[0].name).toBe(product.name);
  expect(productList.headers.get('cache-control')).toBe('no-store');
  expect((await products.POST(request('/api/admin/products', 'POST', product, token))).status).toBe(200);
  expect((await productById.PATCH(request('/api/admin/products/1', 'PATCH', { price: 3000, stock: 9 }, token), { params: Promise.resolve({ id: '1' }) })).status).toBe(200);
  expect(product.price).toBe(3000); expect(product.stock).toBe(9);
  const list = await orders.GET(request('/api/admin/orders', 'GET', undefined, token));
  expect((await list.json()).orders[0].items).toHaveLength(1);
  expect((await orderById.PATCH(request('/api/admin/orders/VRN-admin-test', 'PATCH', { status: 'Dispatched' }, token), { params: Promise.resolve({ id: order.id }) })).status).toBe(200);
  expect(order.status).toBe('Dispatched');
  expect((await productById.DELETE(request('/api/admin/products/1', 'DELETE', undefined, token), { params: Promise.resolve({ id: '1' }) })).status).toBe(200);
  expect(dbCalls).toEqual(['select', 'insert', 'update', 'select', 'update', 'delete']);
});

test('tampered/expired sessions reject both uploads and mutations without database access', async () => {
  const expired = session.createAdminSession(Date.now() - (session.ADMIN_SESSION_SECONDS + 1) * 1000);
  for (const token of [expired, 'forged.cookie']) {
    expect((await upload.POST(request('/api/admin/upload', 'POST', {}, token))).status).toBe(401);
    expect((await productById.PATCH(request('/api/admin/products/1', 'PATCH', {}, token), { params: Promise.resolve({ id: '1' }) })).status).toBe(401);
  }
  expect(dbCalls).toHaveLength(0);
});

test('authenticated image upload still processes an image', async () => {
  const token = session.createAdminSession();
  const body = new FormData();
  body.set('file', new File(['<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="purple"/></svg>'], 'test.svg', { type: 'image/svg+xml' }));
  const response = await upload.POST(new NextRequest('http://localhost:3000/api/admin/upload', { method: 'POST', headers: { cookie: cookie(token) }, body }));
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.url).toMatch(/^\/uploads\/saree-.*\.webp$/);
  const output = path.join(process.cwd(), 'public', data.url);
  try { expect((await readFile(output)).length).toBeGreaterThan(0); }
  finally { await unlink(output); }
});

test('cross-origin login, mutations, and logout are rejected', async () => {
  const token = session.createAdminSession();
  const headers = { origin: 'https://untrusted.example' };
  expect((await auth.POST(request('/api/admin/auth', 'POST', credentials(), undefined, headers))).status).toBe(403);
  expect((await products.POST(request('/api/admin/products', 'POST', product, token, headers))).status).toBe(403);
  expect((await auth.DELETE(request('/api/admin/auth', 'DELETE', undefined, token, headers))).status).toBe(403);
  expect(dbCalls).toHaveLength(0);
});

test('same-origin login works with Host or forwarded host when Next uses an internal URL', async () => {
  for (const headers of [
    { host: '127.0.0.1:3109', origin: 'http://127.0.0.1:3109' },
    { host: 'internal:3000', 'x-forwarded-host': 'store.example', 'x-forwarded-proto': 'https', origin: 'https://store.example' },
  ]) {
    const req = new NextRequest('http://localhost:3000/api/admin/auth', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(credentials()) });
    expect((await auth.POST(req)).status).toBe(200);
  }
});

test('logout expires the same cookie and the next cookie-free request is rejected', async () => {
  const token = session.createAdminSession();
  const response = await auth.DELETE(request('/api/admin/auth', 'DELETE', undefined, token));
  expect(response.status).toBe(200);
  const cleared = response.cookies.get(session.ADMIN_SESSION_COOKIE);
  expect(cleared.value).toBe(''); expect(cleared.path).toBe('/api/admin'); expect(cleared.maxAge).toBe(0);
  expect((await auth.GET(request('/api/admin/auth'))).status).toBe(401);
  expect((await products.GET(request('/api/admin/products'))).status).toBe(401);
});

test('the legacy unfiltered public order list also rejects anonymous access', async () => {
  const response = await publicOrders.GET(request('/api/orders'));
  expect(response.status).toBe(401);
  expect(dbCalls).toHaveLength(0);
});

test('malformed login JSON is a 400 and does not issue a cookie', async () => {
  const response = await auth.POST(new NextRequest('http://localhost:3000/api/admin/auth', { method: 'POST', body: '{' }));
  expect(response.status).toBe(400);
  expect(response.headers.get('set-cookie')).toBeNull();
});
