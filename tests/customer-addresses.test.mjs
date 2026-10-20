import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  normalizeIndianMobile, normalizePincode, parseCustomerAddressInput, parseOrderShipping,
  AddressValidationError,
} from '../src/lib/address-validation.ts';

const originalEnv = { ...process.env };
const envKeys = ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_AUTH_EMULATOR_HOST', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID', 'SQL_HOST', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_IDS'];
let claims, verificationFailure, calls, tables;
const dialect = new PgDialect();
const columns = { user_id: 'userId', is_default: 'isDefault', uid: 'uid', id: 'id', full_name: 'fullName' };

function rowMatches(row, condition) {
  if (!condition) return true;
  const query = dialect.sqlToQuery(condition);
  const sql = query.sql.replace(/"/g, '');
  const matcher = /(?:\w+\.)?(\w+)\s*=\s*\$(\d+)/g;
  let match;
  while ((match = matcher.exec(sql))) {
    const field = columns[match[1]] || match[1];
    if (row[field] !== query.params[Number(match[2]) - 1]) return false;
  }
  return true;
}

function result(execute) {
  return {
    then: (resolve, reject) => Promise.resolve().then(execute).then(resolve, reject),
    limit() { return this; },
    orderBy() { return this; },
    returning: () => Promise.resolve().then(execute),
  };
}

const db = {
  select: () => ({ from: (table) => {
    let condition;
    const query = result(() => {
      const name = getTableName(table);
      calls.push({ action: 'select', table: name });
      return structuredClone(tables[name].filter((row) => rowMatches(row, condition)));
    });
    query.where = (value) => { condition = value; return query; };
    return query;
  } }),
  insert: (table) => ({ values: (input) => result(() => {
    const name = getTableName(table);
    calls.push({ action: 'insert', table: name, input });
    const row = { id: Math.max(0, ...tables[name].map((entry) => entry.id || 0)) + 1, ...input };
    tables[name].push(row);
    return [row];
  }) }),
  update: (table) => ({ set: (values) => ({ where: (condition) => result(() => {
    const name = getTableName(table);
    calls.push({ action: 'update', table: name, values });
    const updated = [];
    for (const row of tables[name]) {
      if (!rowMatches(row, condition)) continue;
      Object.assign(row, values);
      updated.push(row);
    }
    return updated;
  }) }) }),
  delete: (table) => ({ where: (condition) => result(() => {
    const name = getTableName(table);
    calls.push({ action: 'delete', table: name });
    const kept = tables[name].filter((row) => !rowMatches(row, condition));
    const removed = tables[name].length - kept.length;
    tables[name] = kept;
    return { count: removed };
  }) }),
  transaction: async (fn) => fn(db),
};

mock.module('firebase-admin/app', () => ({
  getApps: () => [],
  applicationDefault: () => ({ testOnly: true }),
  cert: (fields) => fields,
  initializeApp: () => ({ name: 'varnam-customer-auth' }),
}));
mock.module('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: async (token) => {
  if (verificationFailure) throw Object.assign(new Error('SDK verification failure'), { code: verificationFailure });
  if (token === 'test-bob-token') return { uid: 'firebase-bob', email: 'bob@example.test', name: 'Bob', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
  if (token !== 'test-alice-token') throw Object.assign(new Error('invalid'), { code: 'auth/invalid-id-token' });
  return claims;
} }) }));
mock.module('../src/db/index.ts', () => ({ db }));

const { GET: listAddresses, POST: createAddress } = await import('../src/app/api/addresses/route.ts');
const { PATCH: updateAddress, DELETE: deleteAddress } = await import('../src/app/api/addresses/[id]/route.ts');
const { POST: createOrder } = await import('../src/app/api/orders/route.ts');
const { fallbackProducts } = await import('../src/data/products.ts');

function request(path, method = 'GET', body, token) {
  return new NextRequest('http://localhost:3000' + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const context = (id) => ({ params: Promise.resolve({ id: String(id) }) });
const addressBody = (overrides = {}) => ({
  label: 'Home', fullName: 'Ananya Rao', phone: '9876543210', line1: '12 Rose Street',
  line2: 'Flat 2', landmark: 'Near temple', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001',
  ...overrides,
});
const orderBody = (overrides = {}) => ({
  items: [{ id: fallbackProducts[0].id, qty: 1, finish: 'Included' }],
  customerName: 'Ananya Rao', email: 'ananya@example.test', phone: '9876543210',
  address: '12 Rose Street', apartment: 'Flat 2', landmark: 'Near temple',
  city: 'Chennai', state: 'Tamil Nadu', pincode: '600001',
  ...overrides,
});

beforeEach(() => {
  for (const key of envKeys) delete process.env[key];
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-public-api-key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test-only-project.firebaseapp.com';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-only-project';
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'test-public-app-id';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/test-only/not-a-real-credential.json';
  process.env.SQL_HOST = 'localhost';
  claims = { uid: 'firebase-alice', email: 'alice@example.test', name: 'Alice', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
  verificationFailure = null;
  calls = [];
  tables = {
    users: [
      { id: 1, uid: 'firebase-alice', email: 'alice@example.test', name: 'Alice', phone: null },
      { id: 2, uid: 'firebase-bob', email: 'bob@example.test', name: 'Bob', phone: null },
    ],
    customer_addresses: [
      { id: 10, userId: 2, label: 'Office', fullName: 'Bob', phone: '9123456780', line1: '9 Other Street', line2: null, landmark: null, city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001', country: 'India', isDefault: true },
    ],
    orders: [],
    products: [],
    coupons: [],
    site_settings: [],
  };
});
afterAll(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  mock.restore();
});

test('Indian mobile and pincode helpers accept common prefixes and reject invalid values', () => {
  expect(normalizeIndianMobile('9876543210')).toBe('9876543210');
  expect(normalizeIndianMobile('+91 98765 43210')).toBe('9876543210');
  expect(normalizeIndianMobile('919876543210')).toBe('9876543210');
  expect(normalizeIndianMobile('09876543210')).toBe('9876543210');
  expect(normalizePincode('600001')).toBe('600001');
  for (const value of ['123', '5123456789', '987654321', 'abcdefghij', '', null]) {
    expect(() => normalizeIndianMobile(value)).toThrow(AddressValidationError);
  }
  for (const value of ['60001', '6000011', '60000a', '', null]) {
    expect(() => normalizePincode(value)).toThrow(AddressValidationError);
  }
});

test('address and order shipping parsers keep snapshot fields and reject incomplete input', () => {
  const address = parseCustomerAddressInput({ first: 'Ananya', last: 'Rao', phone: '+91 9876543210', address: '12 Rose Street', apartment: 'Flat 2', city: 'Chennai', state: 'Tamil Nadu', pin: '600001' });
  expect(address.fullName).toBe('Ananya Rao');
  expect(address.phone).toBe('9876543210');
  expect(address.line2).toBe('Flat 2');
  const shipping = parseOrderShipping({ first: 'Ananya', last: 'Rao', phone: '9876543210', address: '12 Rose Street', landmark: 'Near temple', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' });
  expect(shipping.shippingLine1).toBe('12 Rose Street');
  expect(shipping.shippingLandmark).toBe('Near temple');
  expect(shipping.address).toContain('Near temple');
  expect(() => parseOrderShipping({ customerName: 'A', phone: '123', address: 'X', city: 'Y', state: 'Z', pincode: '600001' })).toThrow('10-digit');
  expect(() => parseCustomerAddressInput({ fullName: 'A', phone: '9876543210', line1: 'X', city: 'Y', state: 'Z', pincode: '12' })).toThrow('6-digit');
});

test('address APIs require a verified Google token', async () => {
  expect((await listAddresses(request('/api/addresses'))).status).toBe(401);
  expect((await createAddress(request('/api/addresses', 'POST', addressBody()))).status).toBe(401);
  expect((await updateAddress(request('/api/addresses/10', 'PATCH', addressBody()), context(10))).status).toBe(401);
  expect((await deleteAddress(request('/api/addresses/10', 'DELETE'), context(10))).status).toBe(401);
});

test('a customer can only list, change and delete their own addresses', async () => {
  expect((await updateAddress(request('/api/addresses/10', 'PATCH', addressBody(), 'test-alice-token'), context(10))).status).toBe(404);
  expect((await deleteAddress(request('/api/addresses/10', 'DELETE', undefined, 'test-alice-token'), context(10))).status).toBe(404);
  const created = await createAddress(request('/api/addresses', 'POST', addressBody(), 'test-alice-token'));
  expect(created.status).toBe(201);
  const { address } = await created.json();
  expect(address.phone).toBe('9876543210');
  expect(address.isDefault).toBe(true);
  expect(tables.customer_addresses.some((row) => row.userId === 1 && row.line1 === '12 Rose Street')).toBe(true);

  const aliceAddresses = (await (await listAddresses(request('/api/addresses', 'GET', undefined, 'test-alice-token'))).json()).addresses;
  expect(aliceAddresses.map((row) => row.id)).toEqual([address.id]);
  expect(aliceAddresses.every((row) => row.fullName === 'Ananya Rao')).toBe(true);

  const bobAddresses = (await (await listAddresses(request('/api/addresses', 'GET', undefined, 'test-bob-token'))).json()).addresses;
  expect(bobAddresses.map((row) => row.id)).toEqual([10]);

  expect((await updateAddress(request(`/api/addresses/${address.id}`, 'PATCH', addressBody({ fullName: 'Bob Stolen' }), 'test-bob-token'), context(address.id))).status).toBe(404);
  expect(tables.customer_addresses.find((row) => row.id === address.id).fullName).toBe('Ananya Rao');
});

test('address create/update reject invalid phone and pincode', async () => {
  expect((await createAddress(request('/api/addresses', 'POST', addressBody({ phone: '12345' }), 'test-alice-token'))).status).toBe(400);
  expect((await createAddress(request('/api/addresses', 'POST', addressBody({ pincode: '60001' }), 'test-alice-token'))).status).toBe(400);
  expect(tables.customer_addresses.filter((row) => row.userId === 1)).toHaveLength(0);
});

test('orders store a shipping snapshot and reject invalid delivery details', async () => {
  const created = await createOrder(request('/api/orders', 'POST', orderBody()));
  expect(created.status).toBe(200);
  const { order } = await created.json();
  expect(order.shippingFullName).toBe('Ananya Rao');
  expect(order.shippingLine1).toBe('12 Rose Street');
  expect(order.shippingLine2).toBe('Flat 2');
  expect(order.shippingLandmark).toBe('Near temple');
  expect(order.shippingPincode).toBe('600001');
  expect(order.shippingPhone).toBe('9876543210');
  expect((await createOrder(request('/api/orders', 'POST', orderBody({ phone: '1234567890' })))).status).toBe(400);
  expect((await createOrder(request('/api/orders', 'POST', orderBody({ pincode: '6000' })))).status).toBe(400);
});
