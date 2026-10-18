import { beforeEach, afterAll, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

// SDK doubles never read a credential file or contact Google. Real ID-token
// cryptography/revocation is delegated to firebase-admin, with checkRevoked=true.
const originalEnv = { ...process.env };
const envKeys = ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_AUTH_EMULATOR_HOST'];
let claims, verificationFailure, initializationFailure, verified, initialized, credentialCalls, calls, tables, unavailable;
mock.module('firebase-admin/app', () => ({
  getApps: () => [],
  applicationDefault: () => { credentialCalls.push('applicationDefault'); return { testOnly: true }; },
  cert: (fields) => { credentialCalls.push(fields); return { testOnly: true }; },
  initializeApp: (options, name) => { if (initializationFailure) throw new Error('Invalid credentials'); initialized.push({ options, name }); return { name }; },
}));
mock.module('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: async (...args) => {
  verified.push(args);
  if (verificationFailure) throw Object.assign(new Error('SDK verification failure'), { code: verificationFailure });
  if (args[0] === 'test-bob-token') return { ...claims, uid: 'firebase-bob', email: 'bob@example.test', name: 'Bob' };
  return claims;
} }) }));

const dialect = new PgDialect();
mock.module('../src/db/index.ts', () => ({ db: {
  select: () => ({ from: (table) => {
    const name = getTableName(table); let filter, cap;
    const read = async () => {
      calls.push({ action: 'select', table: name, filter });
      if (unavailable) throw new Error('Database unavailable');
      let rows = structuredClone(tables[name]);
      if (filter) rows = rows.filter((row) => row[name === 'users' ? 'uid' : 'email'] === filter);
      return cap == null ? rows : rows.slice(0, cap);
    };
    const query = { where: (condition) => { filter = dialect.sqlToQuery(condition).params[0]; return query; }, limit: (value) => { cap = value; return query; }, orderBy: () => query, then: (resolve, reject) => read().then(resolve, reject) };
    return query;
  } }),
  insert: (table) => ({ values: (input) => {
    const name = getTableName(table);
    const save = async () => {
      calls.push({ action: 'insert', table: name, input });
      if (unavailable) throw new Error('Database unavailable');
      const existing = name === 'users' && tables.users.find((row) => row.uid === input.uid);
      if (existing) { Object.assign(existing, input); return [existing]; }
      const row = { id: tables[name].length + 1, ...input }; tables[name].push(row); return [row];
    };
    const query = { onConflictDoUpdate: () => query, returning: save, then: (resolve, reject) => save().then(resolve, reject) };
    return query;
  } }),
} }));

const { POST: sync } = await import('../src/app/api/auth/sync/route.ts');
const { GET: history, POST: checkout } = await import('../src/app/api/orders/route.ts');
const { fallbackProducts } = await import('../src/data/products.ts');
function request(path, method = 'GET', body, token) {
  return new NextRequest('http://localhost:3000'+path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer '+token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const configure = () => { process.env.GOOGLE_APPLICATION_CREDENTIALS = '/test-only/not-a-real-credential.json'; };
const item = () => [{ id: fallbackProducts[0].id, qty: 1, finish: 'Included' }];

beforeEach(() => {
  for (const key of envKeys) delete process.env[key];
  claims = { uid: 'firebase-alice', email: 'alice@example.test', name: 'Alice', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
  verified = []; initialized = []; credentialCalls = []; calls = []; verificationFailure = null; initializationFailure = false; unavailable = false;
  tables = { products: [], coupons: [], site_settings: [], users: [{ id: 1, uid: 'firebase-alice', email: 'alice@example.test', name: 'Alice' }], orders: [
    { id: 'VRN-alice', email: 'alice@example.test', total: 1000, createdAt: '2026-10-18', itemsJson: '[]' },
    { id: 'VRN-bob', email: 'bob@example.test', total: 2000, createdAt: '2026-10-18', itemsJson: '[]' },
  ] };
});
afterAll(() => { for (const key of envKeys) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; } mock.restore(); });

test.each([false, true])('fake posted UID/email without a token is rejected before SDK or DB access (configured=%s)', async (configured) => {
  if (configured) configure();
  const response = await sync(request('/api/auth/sync', 'POST', { uid: 'local-forged', email: 'bob@example.test', name: 'Impersonator' }));
  expect(response.status).toBe(401); expect((await response.json()).error).toContain('Sign in with Google');
  expect(response.headers.get('cache-control')).toContain('no-store'); expect(calls).toHaveLength(0); expect(initialized).toHaveLength(0);
});

test('missing or incomplete configuration rejects bearer sync/history instead of trusting identity fields', async () => {
  for (const partial of [{}, { FIREBASE_PROJECT_ID: 'test-only-project' }, { FIREBASE_PROJECT_ID: 'test-only-project', FIREBASE_CLIENT_EMAIL: 'test@example.test' }]) {
    Object.assign(process.env, partial);
    for (const response of [await sync(request('/api/auth/sync', 'POST', { uid: 'forged', email: 'bob@example.test' }, 'untrusted')), await history(request('/api/orders', 'GET', undefined, 'untrusted'))]) {
      expect(response.status).toBe(503); expect((await response.json()).error).toContain('not configured');
    }
  }
  expect(calls).toHaveLength(0); expect(verified).toHaveLength(0);
});

test('configured auth emulator fails closed and cannot accept unsigned emulator identities', async () => {
  configure(); process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  expect((await sync(request('/api/auth/sync', 'POST', {}, 'unsigned-emulator-token'))).status).toBe(503);
  expect(calls).toHaveLength(0); expect(verified).toHaveLength(0);
});

test.each(['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'])('SDK rejection %s denies sync and history with no DB access', async (code) => {
  configure(); verificationFailure = code;
  expect((await sync(request('/api/auth/sync', 'POST', { uid: 'forged', email: 'bob@example.test' }, 'bad-token'))).status).toBe(401);
  expect((await history(request('/api/orders?email=bob@example.test', 'GET', undefined, 'bad-token'))).status).toBe(401);
  expect(verified).toEqual([['bad-token', true], ['bad-token', true]]); expect(calls).toHaveLength(0);
});

test('verification outage or invalid credential initialization fails closed without DB access', async () => {
  configure(); verificationFailure = 'auth/internal-error';
  expect((await sync(request('/api/auth/sync', 'POST', {}, 'untrusted'))).status).toBe(503);
  verificationFailure = null; initializationFailure = true;
  expect((await history(request('/api/orders', 'GET', undefined, 'untrusted'))).status).toBe(503);
  expect(calls).toHaveLength(0);
});

test.each([{ email_verified: false }, { email: undefined }, { uid: '' }, { firebase: { sign_in_provider: 'password' } }, { firebase: { sign_in_provider: 'anonymous' } }])('a decoded token without a verified Google identity is rejected: %j', async (overrides) => {
  configure(); Object.assign(claims, overrides);
  expect((await sync(request('/api/auth/sync', 'POST', {}, 'test-alice-token'))).status).toBe(401);
  expect(calls).toHaveLength(0);
});

test('verified sync ignores spoofed body claims, upserts only token identity, and uses configured project/file credentials', async () => {
  configure();
  const response = await sync(request('/api/auth/sync', 'POST', { uid: 'local-forged', email: 'bob@example.test', name: 'Impersonator' }, 'test-alice-token'));
  expect(response.status).toBe(200);
  expect((await response.json()).user).toEqual({ uid: 'firebase-alice', email: 'alice@example.test', name: 'Alice' });
  expect(calls[0].input).toEqual({ uid: 'firebase-alice', email: 'alice@example.test', name: 'Alice' });
  expect(verified).toEqual([['test-alice-token', true]]); expect(credentialCalls).toEqual(['applicationDefault']);
  expect(initialized[0].name).toBe('varnam-customer-auth'); expect(initialized[0].options.projectId).toBeTruthy();
});

test('the alternative server-only service-account fields support escaped PEM newlines', async () => {
  // Fixture values are passed only to the SDK double, never used as credentials.
  process.env.FIREBASE_PROJECT_ID = 'test-only-project'; process.env.FIREBASE_CLIENT_EMAIL = 'test@example.test'; process.env.FIREBASE_PRIVATE_KEY = 'fixture-line-one\\nfixture-line-two';
  expect((await sync(request('/api/auth/sync', 'POST', undefined, 'test-alice-token'))).status).toBe(200);
  expect(credentialCalls).toEqual([{ projectId: 'test-only-project', clientEmail: 'test@example.test', privateKey: 'fixture-line-one\nfixture-line-two' }]);
  expect(initialized[0].options.projectId).toBe('test-only-project');
});

test('history rejects anonymous email lookup and cross-account email selection; each verified identity sees only its own email orders', async () => {
  configure();
  expect((await history(request('/api/orders?email=bob@example.test'))).status).toBe(401);
  expect((await history(request('/api/orders?email=bob@example.test', 'GET', undefined, 'test-alice-token'))).status).toBe(403);
  expect(calls).toHaveLength(0);
  const alice = await history(request('/api/orders', 'GET', undefined, 'test-alice-token'));
  expect((await alice.json()).orders.map((order) => order.id)).toEqual(['VRN-alice']);
  expect(alice.headers.get('cache-control')).toBe('private, no-store'); expect(alice.headers.get('vary')).toBe('Authorization');
  const bob = await history(request('/api/orders', 'GET', undefined, 'test-bob-token'));
  expect((await bob.json()).orders.map((order) => order.id)).toEqual(['VRN-bob']);
  expect(calls.map((call) => call.filter)).toEqual(['alice@example.test', 'bob@example.test']);
});

test('unavailable user storage never produces a successful synced profile', async () => {
  configure(); unavailable = true;
  const response = await sync(request('/api/auth/sync', 'POST', {}, 'test-alice-token'));
  expect(response.status).toBe(503); expect((await response.json()).user).toBeUndefined();
});

test('guest checkout still works without Firebase configuration and cannot link a forged UID to an account', async () => {
  const response = await checkout(request('/api/orders', 'POST', { email: 'guest@example.test', uid: 'firebase-alice', items: item(), couponCode: 'OFFER50' }));
  expect(response.status).toBe(200); const { order } = await response.json();
  expect(order.userId).toBeNull(); expect(order.email).toBe('guest@example.test'); expect(order.pricing.couponCode).toBe('OFFER50');
  expect(verified).toHaveLength(0); expect(calls.some((call) => call.table === 'users')).toBe(false);
});

test('an optional authenticated order association uses token UID, never a posted UID; invalid tokens cannot submit orders', async () => {
  configure();
  const response = await checkout(request('/api/orders', 'POST', { uid: 'firebase-bob', email: 'alice@example.test', items: item() }, 'test-alice-token'));
  expect(response.status).toBe(200); expect((await response.json()).order.userId).toBe(1);
  expect(calls.find((call) => call.table === 'users').filter).toBe('firebase-alice');
  calls = []; verificationFailure = 'auth/invalid-id-token';
  expect((await checkout(request('/api/orders', 'POST', { items: item() }, 'forged-token'))).status).toBe(401); expect(calls).toHaveLength(0);
});
