import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const previousEnv = { ...process.env };
const dialect = new PgDialect();
let tables, failures, calls, nextId;

// In-memory stand-in for the drizzle calls the reviews code makes.
const filterRows = (name, rows, where) => {
  if (!where) return rows;
  const { sql, params } = dialect.sqlToQuery(where);
  if (name === 'site_settings' && sql.includes(' in ')) return rows.filter((row) => params.includes(row.key));
  if (sql.includes('"visible"')) return rows.filter((row) => row.visible === params[0]);
  if (sql.includes('"id"')) return rows.filter((row) => row.id === params[0]);
  throw new Error(`Unexpected condition ${sql}`);
};
const chain = (execute) => {
  const query = {
    where(condition) { query.condition = condition; return query; },
    orderBy() { query.sorted = true; return query; },
    returning: () => Promise.resolve().then(() => execute(query)),
    then: (resolve, reject) => Promise.resolve().then(() => execute(query)).then(resolve, reject),
  };
  return query;
};
const touch = (name) => { calls++; if (failures.has(name)) throw new Error('Database unreachable'); };
const db = {
  select: (fields) => ({ from: (table) => chain((query) => {
    const name = getTableName(table); touch(name);
    let rows = filterRows(name, structuredClone(tables[name]), query.condition);
    if (name === 'reviews' && query.sorted) rows.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    return fields ? rows.map((row) => Object.fromEntries(Object.keys(fields).map((key) => [key, row[key]]))) : rows;
  }) }),
  insert: (table) => ({ values: (value) => {
    let upsert = null;
    const query = chain(() => {
      const name = getTableName(table); touch(name);
      if (name === 'site_settings') {
        const existing = tables.site_settings.find((row) => row.key === value.key);
        if (existing && upsert) { Object.assign(existing, upsert); return [existing]; }
        tables.site_settings.push({ ...value }); return [value];
      }
      const row = { id: nextId++, photoUrl: null, reviewDate: null, productId: null, visible: true, sortOrder: 0, ...value };
      tables[name].push(row); return [structuredClone(row)];
    });
    query.onConflictDoUpdate = ({ set }) => { upsert = set; return query; };
    return query;
  } }),
  update: (table) => ({ set: (value) => chain((query) => {
    const name = getTableName(table); touch(name);
    const rows = filterRows(name, tables[name], query.condition);
    for (const row of rows) Object.assign(row, value);
    return structuredClone(rows);
  }) }),
  delete: (table) => ({ where: (condition) => chain(() => {
    const name = getTableName(table); touch(name);
    const removed = filterRows(name, tables[name], condition);
    tables[name] = tables[name].filter((row) => !removed.includes(row));
    return removed;
  }) }),
  transaction: async (callback) => {
    const before = structuredClone(tables);
    try { return await callback(db); } catch (error) { tables = before; throw error; }
  },
};
mock.module('../src/db/index.ts', () => ({ db }));

const { createAdminSession, ADMIN_SESSION_COOKIE } = await import('../src/lib/admin-session.ts');
const reviewsRoute = await import('../src/app/api/admin/reviews/route.ts');
const reviewRoute = await import('../src/app/api/admin/reviews/[id]/route.ts');
const settingsRoute = await import('../src/app/api/admin/reviews/settings/route.ts');
const orderRoute = await import('../src/app/api/admin/reviews/order/route.ts');
const publicRoute = await import('../src/app/api/reviews/route.ts');
const { getPublicReviews } = await import('../src/lib/reviews-server.ts');
const lib = await import('../src/lib/reviews.ts');

const req = (path, method = 'GET', body, authenticated = true, extra = {}) => new NextRequest(`http://localhost${path}`, {
  method,
  headers: { ...(authenticated ? { cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession()}` } : {}), 'content-type': 'application/json', ...extra },
  ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
});
const ctx = (id) => ({ params: Promise.resolve({ id: String(id) }) });
const validReview = { name: 'Lakshmi R', rating: 5, text: 'Beautiful Kanchipuram silk, exactly as pictured.', reviewDate: '2026-09-14', photoUrl: null, productId: 4, visible: true };
const validSettings = { enabled: true, title: 'Loved by our customers', rating: 4.8, reviewCount: 126, googleUrl: 'https://g.page/r/varnam', writeReviewUrl: '' };
const enable = () => tables.site_settings.push({ key: 'reviewsEnabled', value: 'true' });
const addReview = (overrides = {}) => { const row = { id: nextId++, ...validReview, sortOrder: tables.reviews.length, ...overrides }; tables.reviews.push(row); return row; };

beforeEach(() => {
  process.env.ADMIN_LOGIN_EMAIL = `${randomBytes(12).toString('hex')}@example.test`;
  process.env.ADMIN_LOGIN_PASSWORD = randomBytes(32).toString('hex');
  tables = {
    site_settings: [{ key: 'marqueeMessage1', value: 'Dispatch time 2 to 5 business days' }],
    reviews: [],
    products: [{ id: 4, name: 'Ananya green festive saree' }, { id: 7, name: 'Roja pink soft silk saree' }],
  };
  failures = new Set(); calls = 0; nextId = 1;
});
afterAll(() => {
  for (const key of ['ADMIN_LOGIN_EMAIL', 'ADMIN_LOGIN_PASSWORD']) {
    if (previousEnv[key] === undefined) delete process.env[key]; else process.env[key] = previousEnv[key];
  }
  mock.restore();
});

test('every admin reviews route rejects missing/forged sessions and cross-origin writes before touching the DB', async () => {
  const handlers = [
    [reviewsRoute.GET, 'GET'], [reviewsRoute.POST, 'POST'], [reviewRoute.PATCH, 'PATCH'], [reviewRoute.DELETE, 'DELETE'],
    [settingsRoute.PUT, 'PUT'], [orderRoute.PUT, 'PUT'],
  ];
  for (const [handler, method] of handlers) {
    expect((await handler(req('/api/admin/reviews', method, undefined, false), ctx(1))).status).toBe(401);
    expect((await handler(req('/api/admin/reviews', method, undefined, false, { cookie: `${ADMIN_SESSION_COOKIE}=forged` }), ctx(1))).status).toBe(401);
    if (method !== 'GET') expect((await handler(req('/api/admin/reviews', method, {}, true, { origin: 'https://other.example' }), ctx(1))).status).toBe(403);
  }
  expect(calls).toBe(0);
});

test('reviews are validated server-side', async () => {
  const invalid = [
    { ...validReview, name: '   ' },
    { ...validReview, name: 'x'.repeat(81) },
    { ...validReview, rating: 0 }, { ...validReview, rating: 6 }, { ...validReview, rating: 4.5 }, { ...validReview, rating: '5' },
    { ...validReview, text: '' }, { ...validReview, text: 'x'.repeat(601) },
    { ...validReview, reviewDate: '2026-02-30' }, { ...validReview, reviewDate: '14/09/2026' },
    { ...validReview, photoUrl: 'http://example.com/a.jpg' }, { ...validReview, photoUrl: 'javascript:alert(1)' },
    { ...validReview, productId: 999 }, { ...validReview, productId: '4' },
    { ...validReview, visible: 'yes' },
    [validReview], null,
  ];
  for (const body of invalid) expect((await reviewsRoute.POST(req('/api/admin/reviews', 'POST', body))).status).toBe(400);
  expect((await reviewsRoute.POST(req('/api/admin/reviews', 'POST', '{not json'))).status).toBe(400);
  expect(tables.reviews).toHaveLength(0);

  const created = await reviewsRoute.POST(req('/api/admin/reviews', 'POST', { ...validReview, name: '  Lakshmi   R ', text: `  ${'a'.repeat(600)}  ` }));
  expect(created.status).toBe(201);
  const { review } = await created.json();
  expect(review).toMatchObject({ id: 1, name: 'Lakshmi R', rating: 5, productId: 4, visible: true, sortOrder: 0 });
  expect(review.text).toHaveLength(600);
  const second = await (await reviewsRoute.POST(req('/api/admin/reviews', 'POST', { ...validReview, productId: null, reviewDate: '', photoUrl: 'https://lh3.googleusercontent.com/a/photo' }))).json();
  expect(second.review).toMatchObject({ id: 2, sortOrder: 1, productId: null, reviewDate: null, photoUrl: 'https://lh3.googleusercontent.com/a/photo' });
});

test('section settings are validated server-side and stored apart from commerce settings', async () => {
  const invalid = [
    { ...validSettings, rating: 0.9 }, { ...validSettings, rating: 5.1 }, { ...validSettings, rating: '4.8' },
    { ...validSettings, reviewCount: -1 }, { ...validSettings, reviewCount: 1.5 },
    { ...validSettings, title: '' }, { ...validSettings, enabled: 'true' },
    { ...validSettings, googleUrl: 'http://g.page/x' }, { ...validSettings, writeReviewUrl: 'ftp://x' },
    { ...validSettings, marqueeMessage1: 'sneaky' },
  ];
  for (const body of invalid) expect((await settingsRoute.PUT(req('/api/admin/reviews/settings', 'PUT', body))).status).toBe(400);
  const saved = await settingsRoute.PUT(req('/api/admin/reviews/settings', 'PUT', { ...validSettings, rating: 4.83 }));
  expect(saved.status).toBe(200);
  expect((await saved.json()).settings.rating).toBe(4.8);
  const stored = Object.fromEntries(tables.site_settings.map((row) => [row.key, row.value]));
  expect(stored).toMatchObject({ reviewsEnabled: 'true', reviewsRating: '4.8', reviewsCount: '126', reviewsGoogleUrl: 'https://g.page/r/varnam', marqueeMessage1: 'Dispatch time 2 to 5 business days' });
  const all = await (await reviewsRoute.GET(req('/api/admin/reviews'))).json();
  expect(all.settings).toEqual({ ...validSettings, rating: 4.8 });
});

test('visibility rule: hidden by default; shown only when switched on with at least one visible review', async () => {
  addReview({ name: 'Visible one' });
  // Default is OFF: nothing public even with visible reviews.
  expect(await getPublicReviews()).toBeNull();
  expect(await (await publicRoute.GET()).json()).toEqual({ section: null });

  enable();
  tables.reviews[0].visible = false;
  expect(await getPublicReviews()).toBeNull();

  tables.reviews[0].visible = true;
  addReview({ name: 'Hidden one', visible: false });
  addReview({ name: 'First in order', sortOrder: -1 });
  const section = await getPublicReviews();
  expect(section.reviews.map((r) => r.name)).toEqual(['First in order', 'Visible one']);
  expect(section.settings).not.toHaveProperty('enabled');
  for (const review of section.reviews) {
    expect(Object.keys(review).sort()).toEqual(['id', 'name', 'photoUrl', 'productId', 'rating', 'reviewDate', 'text']);
  }
  const body = await (await publicRoute.GET()).json();
  expect(JSON.stringify(body)).not.toContain('Hidden one');

  // Missing table / unreachable DB: section simply doesn't render.
  failures.add('reviews');
  expect(await getPublicReviews()).toBeNull();
});

test('edit, show/hide, delete and reorder', async () => {
  const a = addReview({ name: 'A' }); const b = addReview({ name: 'B' }); const c = addReview({ name: 'C' });
  const hidden = await reviewRoute.PATCH(req(`/api/admin/reviews/${b.id}`, 'PATCH', { ...validReview, name: 'B', visible: false }), ctx(b.id));
  expect(hidden.status).toBe(200);
  expect(tables.reviews.find((r) => r.id === b.id).visible).toBe(false);
  expect((await reviewRoute.PATCH(req('/api/admin/reviews/99', 'PATCH', validReview), ctx(99))).status).toBe(404);
  expect((await reviewRoute.PATCH(req('/api/admin/reviews/x', 'PATCH', validReview), ctx('x'))).status).toBe(400);
  expect((await reviewRoute.PATCH(req(`/api/admin/reviews/${a.id}`, 'PATCH', { ...validReview, rating: 9 }), ctx(a.id))).status).toBe(400);

  for (const ids of [[c.id, a.id], [c.id, a.id, a.id], [c.id, a.id, 99], 'nope']) {
    expect((await orderRoute.PUT(req('/api/admin/reviews/order', 'PUT', { ids }))).status).toBe(400);
  }
  const reordered = await orderRoute.PUT(req('/api/admin/reviews/order', 'PUT', { ids: [c.id, a.id, b.id] }));
  expect(reordered.status).toBe(200);
  expect((await reordered.json()).reviews.map((r) => r.name)).toEqual(['C', 'A', 'B']);

  expect((await reviewRoute.DELETE(req(`/api/admin/reviews/${a.id}`, 'DELETE'), ctx(a.id))).status).toBe(200);
  expect((await reviewRoute.DELETE(req(`/api/admin/reviews/${a.id}`, 'DELETE'), ctx(a.id))).status).toBe(404);
  expect(tables.reviews.map((r) => r.name)).toEqual(['B', 'C']);

  failures.add('reviews');
  expect((await reviewsRoute.GET(req('/api/admin/reviews'))).status).toBe(503);
});

test('display helpers', () => {
  expect(lib.starFillPercent(4.8)).toBe(96);
  expect(lib.starFillPercent(4.25)).toBe(85);
  expect(lib.starFillPercent(9)).toBe(100);
  expect(lib.formatReviewDate('2026-09-14')).toBe('14 Sep 2026');
  expect(lib.formatReviewDate('nope')).toBe('');
  expect(lib.reviewAvatar(' lakshmi')).toMatchObject({ initial: 'L' });
  expect(lib.reviewAvatar('Lakshmi').colour).toBe(lib.reviewAvatar('Lakshmi').colour);
  expect(lib.reviewSettingsFromRows([])).toEqual(lib.DEFAULT_REVIEW_SETTINGS);
  expect(lib.DEFAULT_REVIEW_SETTINGS.enabled).toBe(false);
  expect(lib.reviewSettingsFromRows([{ key: 'reviewsEnabled', value: 'true' }, { key: 'reviewsRating', value: '7' }, { key: 'reviewsGoogleUrl', value: 'javascript:x' }]))
    .toMatchObject({ enabled: true, rating: 5, googleUrl: '' });
});

test('landing page wiring, Studio tab and an additive, idempotent migration', () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  expect(read('src/app/page.tsx')).toContain('await getPublicReviews()');
  expect(read('src/app/page.tsx')).not.toContain("'use client'");
  expect(read('src/components/HomePage.tsx')).toContain('{reviews && <ReviewsSection section={reviews} />}');
  const section = read('src/components/ReviewsSection.tsx');
  for (const text of ['See all reviews on Google', 'Write a review', 'Read more', 'aria-label="Previous reviews"', 'aria-label="Next reviews"', 'Bought:', 'target="_blank"', 'tabIndex={0}']) expect(section).toContain(text);
  expect(section).not.toMatch(/https?:\/\/(?!www\.w3\.org)/); // no external requests (Google "G" is inline SVG)
  const studio = read('src/app/studio-desk/page.tsx');
  expect(studio).toContain("setActiveTab('reviews')");
  expect(read('src/components/StudioReviews.tsx')).toContain('Copy your best Google reviews here');
  expect(read('src/components/StudioReviews.tsx')).toContain('window.confirm(');

  const sql = read('drizzle/0005_reviews.sql');
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS "reviews"');
  expect(sql).toContain('CREATE INDEX IF NOT EXISTS "reviews_visible_sort_idx"');
  expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/i);
  expect(sql).not.toMatch(/ALTER TABLE/i);
  const journal = JSON.parse(read('drizzle/meta/_journal.json'));
  expect(journal.entries.at(-1)).toMatchObject({ idx: 5, tag: '0005_reviews' });
});
