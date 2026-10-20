import { afterAll, afterEach, expect, spyOn, test } from 'bun:test';
import {
  escapeTelegramHtml, formatOrderAdminMessage, notifyAdminsOfOrder, parseTelegramChatIds,
} from '../src/lib/telegram.ts';

const originalEnv = { ...process.env };
const envKeys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_IDS', 'SITE_URL'];
const order = {
  id: 'VRN-1042',
  customerName: 'Ananya <b>Rao</b>',
  email: 'ananya&family@example.test',
  phone: '9876543210',
  address: '12 Rose Street',
  shippingFullName: 'Ananya <b>Rao</b>',
  shippingPhone: '9876543210',
  shippingLine1: '12 Rose <Street>',
  shippingLine2: 'Flat 2',
  shippingLandmark: 'Near temple & park',
  shippingCity: 'Chennai',
  shippingState: 'Tamil Nadu',
  shippingPincode: '600001',
  total: 2650,
  items: [{ id: 1, qty: 2, finish: 'Rose border', name: 'Silk <saree>', unitPrice: 1250, total: 2500 }],
  pricing: { subtotal: 5000, discountAmount: 2500, shipping: 150, total: 2650, couponCode: 'OFFER50' },
  paymentStatus: 'paid',
};

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});
afterAll(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test('HTML escaping covers the characters Telegram parse_mode requires', () => {
  expect(escapeTelegramHtml('Ananya <b>Rao</b> & Co')).toBe('Ananya &lt;b&gt;Rao&lt;/b&gt; &amp; Co');
  expect(parseTelegramChatIds(' 111, -222, , 333 ')).toEqual(['111', '-222', '333']);
  expect(parseTelegramChatIds('')).toEqual([]);
});

test('admin message includes order snapshot, coupon, rupee total and Studio link', () => {
  process.env.SITE_URL = 'https://varnam.example';
  const message = formatOrderAdminMessage(order);
  expect(message).toContain('VRN-1042');
  expect(message).toContain('Status: paid');
  expect(message).toContain('Ananya &lt;b&gt;Rao&lt;/b&gt;');
  expect(message).toContain('ananya&amp;family@example.test');
  expect(message).toContain('9876543210');
  expect(message).toContain('12 Rose &lt;Street&gt;');
  expect(message).toContain('Flat 2');
  expect(message).toContain('Near temple &amp; park');
  expect(message).toContain('Chennai, Tamil Nadu, 600001');
  expect(message).toContain('Silk &lt;saree&gt; (Rose border) × 2 — ₹2,500');
  expect(message).toContain('Coupon OFFER50: −₹2,500');
  expect(message).toContain('Total: ₹2,650');
  expect(message).toContain('https://varnam.example/studio-desk');
  expect(message).not.toContain('<b>Rao</b>');
  expect(message).not.toContain('Silk <saree>');
});

test('pending orders without a coupon still format and fall back to legacy address columns', () => {
  const message = formatOrderAdminMessage({
    id: 'VRN-pending',
    customerName: 'Guest',
    email: 'guest@example.test',
    phone: '9123456780',
    address: 'Legacy line',
    city: 'Madurai',
    state: 'Tamil Nadu',
    pincode: '625001',
    total: 2490,
    items: [{ id: 4, qty: 1, name: 'Cotton saree', total: 2490 }],
    paymentStatus: 'pending payment',
  });
  expect(message).toContain('Status: pending payment');
  expect(message).toContain('Legacy line');
  expect(message).toContain('Madurai, Tamil Nadu, 625001');
  expect(message).not.toContain('Coupon');
});

test('missing Telegram env is a silent no-op that logs a warning and never fetches', async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_ADMIN_CHAT_IDS;
  const warnings = [];
  const warn = spyOn(console, 'warn').mockImplementation((...args) => warnings.push(args.join(' ')));
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network'); });
  try {
    await notifyAdminsOfOrder(order);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warnings.some((line) => line.includes('Telegram'))).toBe(true);
    expect(JSON.stringify(warnings)).not.toContain('bot');
  } finally {
    warn.mockRestore();
    fetchSpy.mockRestore();
  }
});

test.each([
  ['token only', { TELEGRAM_BOT_TOKEN: '123:ABC', TELEGRAM_ADMIN_CHAT_IDS: '' }],
  ['chat ids only', { TELEGRAM_BOT_TOKEN: '', TELEGRAM_ADMIN_CHAT_IDS: '111' }],
  ['whitespace', { TELEGRAM_BOT_TOKEN: '  ', TELEGRAM_ADMIN_CHAT_IDS: ' , ' }],
])('incomplete Telegram env (%s) does not send', async (_label, values) => {
  process.env.TELEGRAM_BOT_TOKEN = values.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_ADMIN_CHAT_IDS = values.TELEGRAM_ADMIN_CHAT_IDS;
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network'); });
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await notifyAdminsOfOrder(order);
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
    warn.mockRestore();
  }
});

test('configured notifications post HTML to every chat id and never expose the token in logs', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'secret-bot-token';
  process.env.TELEGRAM_ADMIN_CHAT_IDS = '111, -222';
  const calls = [];
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await notifyAdminsOfOrder(order);
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.body.chat_id)).toEqual(['111', '-222']);
    expect(calls[0].url).toBe('https://api.telegram.org/botsecret-bot-token/sendMessage');
    expect(calls[0].body.parse_mode).toBe('HTML');
    expect(calls[0].body.text).toContain('VRN-1042');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-bot-token');
  } finally {
    fetchSpy.mockRestore();
    warn.mockRestore();
  }
});

test('Telegram send failures and aborts never reject notifyAdminsOfOrder', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'secret-bot-token';
  process.env.TELEGRAM_ADMIN_CHAT_IDS = '111';
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('timeout'); });
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await expect(notifyAdminsOfOrder(order)).resolves.toBeUndefined();
  } finally {
    fetchSpy.mockRestore();
    warn.mockRestore();
  }
});
