import { beforeEach, afterAll, expect, mock, test } from 'bun:test';
import { createHmac, randomBytes } from 'node:crypto';

// All gateway and DB operations are local doubles. No external payment is made.
const originalEnv = { ...process.env };
let row, remoteOrder, remotePayment, creations, writes, queue;
const fixture = () => ({
  id: 'VRN-payment-test', total: 2650, status: 'Confirmed',
  itemsJson: JSON.stringify({ version: 1, items: [{ id: 1, qty: 1, finish: 'Included', name: 'Silk saree', total: 2500 }], pricing: { subtotal: 5000, discountAmount: 2500, shipping: 150, total: 2650, couponCode: 'OFFER50' } }),
});

mock.module('../src/db/index.ts', () => ({ db: {
  transaction: (fn) => {
    const task = queue.then(async () => {
      let working = row ? structuredClone(row) : undefined;
      const tx = {
        select: () => ({ from: () => ({ where: () => ({ for: async (lock) => {
          expect(lock).toBe('update');
          return working ? [working] : [];
        } }) }) }),
        update: () => ({ set: (values) => ({ where: async () => {
          working = { ...working, ...values };
          writes++;
        } }) }),
      };
      const result = await fn(tx);
      row = working;
      return result;
    });
    queue = task.catch(() => {});
    return task;
  },
} }));
mock.module('razorpay', () => ({ default: class {
  constructor(config) {
    expect(config.key_id).toBe(process.env.RAZORPAY_KEY_ID);
    expect(config.key_secret).toBe(process.env.RAZORPAY_KEY_SECRET);
  }
  orders = {
    create: async (input) => {
      creations++;
      remoteOrder = { ...input, id: 'order_gateway', status: 'created' };
      return structuredClone(remoteOrder);
    },
    fetch: async (id) => {
      expect(id).toBe(remoteOrder.id);
      return structuredClone(remoteOrder);
    },
  };
  payments = { fetch: async (id) => {
    expect(id).toBe(remotePayment.id);
    return structuredClone(remotePayment);
  } };
} }));

const { createCheckout, verifyCheckout, receiveWebhook, validSignature } = await import('../src/lib/razorpay.ts');
const { readOrderSnapshot } = await import('../src/lib/order-pricing.ts');
const { POST: createRoute } = await import('../src/app/api/payments/razorpay/order/route.ts');
const { POST: verifyRoute } = await import('../src/app/api/payments/razorpay/verify/route.ts');
const { POST: webhookRoute } = await import('../src/app/api/payments/razorpay/webhook/route.ts');
const sign = (body, secret = process.env.RAZORPAY_KEY_SECRET) => createHmac('sha256', secret).update(body).digest('hex');
const payment = () => readOrderSnapshot(row.itemsJson).payment;
const proof = () => ({ orderId: row.id, razorpay_order_id: remoteOrder.id, razorpay_payment_id: remotePayment.id, razorpay_signature: sign(`${remoteOrder.id}|${remotePayment.id}`) });
const request = (body) => new Request('https://example.test/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const capturedEvent = () => JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: remotePayment.id, order_id: remoteOrder.id } } } });

beforeEach(() => {
  process.env.RAZORPAY_KEY_ID = randomBytes(12).toString('hex');
  process.env.RAZORPAY_KEY_SECRET = randomBytes(32).toString('hex');
  process.env.RAZORPAY_WEBHOOK_SECRET = randomBytes(32).toString('hex');
  row = fixture(); remoteOrder = undefined; creations = 0; writes = 0; queue = Promise.resolve();
  remotePayment = { id: 'pay_gateway', order_id: 'order_gateway', amount: 265000, currency: 'INR', status: 'captured', captured: true };
});
afterAll(() => {
  for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
  mock.restore();
});

test('gateway amount uses saved discounted total plus shipping; browser amount is ignored', async () => {
  const response = await createRoute(request({ orderId: row.id, amount: 1, status: 'paid' }));
  const result = await response.json();
  expect(response.status).toBe(200);
  expect(result.amount).toBe(265000);
  expect(result.currency).toBe('INR');
  expect(result.keyId).toBe(process.env.RAZORPAY_KEY_ID);
  expect(JSON.stringify(result)).not.toContain(process.env.RAZORPAY_KEY_SECRET);
  expect(payment().status).toBe('pending');
  expect(remoteOrder.notes.localOrderId).toBe(row.id);
});

test('concurrent starts reuse one gateway order and preserve the price snapshot', async () => {
  const initial = readOrderSnapshot(row.itemsJson);
  const results = await Promise.all([createCheckout(row.id), createCheckout(row.id), createCheckout(row.id)]);
  expect(creations).toBe(1);
  expect(new Set(results.map((r) => r.orderId)).size).toBe(1);
  expect(readOrderSnapshot(row.itemsJson).pricing).toEqual(initial.pricing);
  expect(readOrderSnapshot(row.itemsJson).items).toEqual(initial.items);
});

test('legacy item arrays remain payable and readable', async () => {
  row.itemsJson = JSON.stringify([{ id: 1, qty: 1, finish: 'Included' }]);
  await createCheckout(row.id);
  expect(readOrderSnapshot(row.itemsJson).items).toHaveLength(1);
});

test('missing keys return a clear 503 with WhatsApp fallback and do not write', async () => {
  delete process.env.RAZORPAY_KEY_SECRET;
  const response = await createRoute(request({ orderId: row.id }));
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain('WhatsApp');
  expect(writes).toBe(0);
});

test.each(['Cancelled', 'cancelled'])('cancelled order (%s) cannot start payment', async (status) => {
  row.status = status;
  await expect(createCheckout(row.id)).rejects.toThrow('cancelled');
  expect(creations).toBe(0);
});

test.each([0, -1, 0.001, Number.MAX_SAFE_INTEGER])('invalid total %s cannot start payment', async (total) => {
  row.total = total;
  await expect(createCheckout(row.id)).rejects.toThrow('invalid payment total');
});

test('missing and empty orders are rejected', async () => {
  row.itemsJson = '[]';
  await expect(createCheckout(row.id)).rejects.toThrow('no products');
  row = undefined;
  await expect(createCheckout('missing')).rejects.toThrow('not found');
});

test('HMAC uses constant-time comparison and rejects malformed or altered signatures', () => {
  expect(validSignature('body', sign('body'), process.env.RAZORPAY_KEY_SECRET)).toBe(true);
  expect(validSignature('altered', sign('body'), process.env.RAZORPAY_KEY_SECRET)).toBe(false);
  for (const invalid of ['', 'xyz', 'a'.repeat(63), 'a'.repeat(65)]) expect(validSignature('body', invalid, process.env.RAZORPAY_KEY_SECRET)).toBe(false);
});

test('valid signed captured payment is paid, idempotent, and confirms a pending order', async () => {
  row.status = 'Payment pending';
  await createCheckout(row.id);
  const response = await verifyRoute(request(proof()));
  expect(response.status).toBe(200);
  expect(payment().status).toBe('paid');
  expect(payment().paymentId).toBe(remotePayment.id);
  expect(payment().paidAt).toBeTruthy();
  expect(row.status).toBe('Confirmed');
  const before = writes;
  expect(await verifyCheckout(proof())).toEqual({ status: 'paid' });
  expect(await createCheckout(row.id)).toEqual({ status: 'paid' });
  expect(writes).toBe(before);
  expect(creations).toBe(1);
});

test('Razorpay capture promotes Handloom Finishing to Confirmed and leaves Delivered alone', async () => {
  row.status = 'Handloom Finishing';
  await createCheckout(row.id);
  await verifyCheckout(proof());
  expect(row.status).toBe('Confirmed');

  row = fixture();
  row.status = 'Delivered';
  await createCheckout(row.id);
  await verifyCheckout(proof());
  expect(payment().status).toBe('paid');
  expect(row.status).toBe('Delivered');
});

test('forged signature and swapped provider order ID never mark paid', async () => {
  await createCheckout(row.id);
  await expect(verifyCheckout({ ...proof(), razorpay_signature: randomBytes(32).toString('hex') })).rejects.toThrow('verification failed');
  await expect(verifyCheckout({ ...proof(), razorpay_order_id: 'order_other' })).rejects.toThrow('verification failed');
  expect(payment().status).toBe('pending');
});

test.each([{ amount: 1 }, { currency: 'USD' }, { order_id: 'order_other' }, { status: 'failed', captured: false }])('gateway mismatch %j never marks paid', async (override) => {
  await createCheckout(row.id);
  Object.assign(remotePayment, override);
  await expect(verifyCheckout(proof())).rejects.toThrow();
  expect(payment().status).toBe('pending');
});

test('changed saved total cannot reuse or confirm a pending payment', async () => {
  await createCheckout(row.id);
  row.total++;
  await expect(createCheckout(row.id)).rejects.toThrow('total');
  await expect(verifyCheckout(proof())).rejects.toThrow('do not match');
  expect(payment().status).toBe('pending');
});

test('authorized payment is processing until a signed capture webhook; duplicates are safe', async () => {
  await createCheckout(row.id);
  remotePayment.status = 'authorized'; remotePayment.captured = false;
  expect((await verifyRoute(request(proof()))).status).toBe(202);
  expect(payment().status).toBe('authorized');
  expect(await createCheckout(row.id)).toEqual({ status: 'processing' });
  remotePayment.status = 'captured'; remotePayment.captured = true;
  const raw = capturedEvent();
  await receiveWebhook(raw, sign(raw, process.env.RAZORPAY_WEBHOOK_SECRET));
  expect(payment().status).toBe('paid');
  const before = writes;
  await receiveWebhook(raw, sign(raw, process.env.RAZORPAY_WEBHOOK_SECRET));
  expect(writes).toBe(before);
});

test('provider-paid order awaiting webhook cannot open another Checkout', async () => {
  await createCheckout(row.id);
  remoteOrder.status = 'paid';
  expect(await createCheckout(row.id)).toEqual({ status: 'processing' });
  expect(creations).toBe(1);
  expect(payment().status).toBe('pending');
});

test('capture after browser closure is confirmed, even if fulfilment was cancelled', async () => {
  await createCheckout(row.id);
  row.status = 'Cancelled';
  const raw = capturedEvent();
  const response = await webhookRoute(new Request('https://example.test/api', { method: 'POST', body: raw, headers: { 'x-razorpay-signature': sign(raw, process.env.RAZORPAY_WEBHOOK_SECRET) } }));
  expect(response.status).toBe(200);
  expect(payment().status).toBe('paid');
  expect(row.status).toBe('Cancelled');
});

test('webhook validates the raw body with its separate secret', async () => {
  await createCheckout(row.id);
  const raw = capturedEvent();
  await expect(receiveWebhook(raw, sign(raw))).rejects.toThrow('signature');
  await expect(receiveWebhook(raw + ' ', sign(raw, process.env.RAZORPAY_WEBHOOK_SECRET))).rejects.toThrow('signature');
  expect(payment().status).toBe('pending');
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  await expect(receiveWebhook(raw, '')).rejects.toThrow('not configured');
});

test('signed webhook with an amount mismatch is rejected and unrelated events ignored', async () => {
  await createCheckout(row.id);
  remotePayment.amount = 1;
  const raw = capturedEvent();
  await expect(receiveWebhook(raw, sign(raw, process.env.RAZORPAY_WEBHOOK_SECRET))).rejects.toThrow('do not match');
  const unrelated = JSON.stringify({ event: 'payment.failed' });
  await receiveWebhook(unrelated, sign(unrelated, process.env.RAZORPAY_WEBHOOK_SECRET));
  expect(payment().status).toBe('pending');
});

test('bad request data is rejected without creating payments', async () => {
  expect((await createRoute(request({ amount: 1 }))).status).toBe(400);
  expect((await createRoute(new Request('https://example.test/api', { method: 'POST', body: '{' }))).status).toBe(400);
  expect((await verifyRoute(request({ orderId: row.id }))).status).toBe(400);
  expect(creations).toBe(0);
});

test('Studio renders paid reference or disabled cancelled payment action', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StudioPayment } = await import('../src/components/StudioPayment.tsx');
  const props = { orderId: row.id, total: row.total, customerName: 'Customer', email: 'customer@example.test', cancelled: false, onPaid() {} };
  const unpaid = renderToStaticMarkup(createElement(StudioPayment, props));
  expect(unpaid).toContain('with Razorpay');
  const paid = renderToStaticMarkup(createElement(StudioPayment, { ...props, payment: { status: 'paid', paymentId: 'pay_reference' } }));
  expect(paid).toContain('Paid · Razorpay');
  expect(paid).toContain('pay_reference');
  expect(paid).not.toContain('<button');
  const cancelled = renderToStaticMarkup(createElement(StudioPayment, { ...props, cancelled: true }));
  expect(cancelled).toContain('disabled');
});

test('Checkout script failure allows retry; concurrent loads share a single script', async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  try {
    const scripts = [];
    globalThis.window = { setTimeout };
    globalThis.document = { createElement: () => ({ remove() {} }), head: { appendChild: (script) => scripts.push(script) } };
    const { loadRazorpayCheckout } = await import('../src/components/StudioPayment.tsx');
    const first = loadRazorpayCheckout();
    expect(loadRazorpayCheckout()).toBe(first);
    expect(scripts).toHaveLength(1);
    scripts[0].onerror();
    await expect(first).rejects.toThrow('WhatsApp');
    const retry = loadRazorpayCheckout();
    expect(scripts).toHaveLength(2);
    expect(scripts[1].src).toBe('https://checkout.razorpay.com/v1/checkout.js');
    window.Razorpay = class {};
    scripts[1].onload();
    await retry;
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  }
});

test('WhatsApp confirmation includes saved payment status and reference', async () => {
  const { createSavedOrderWhatsAppMessage } = await import('../src/lib/whatsapp.ts');
  const message = createSavedOrderWhatsAppMessage({ ...row, ...readOrderSnapshot(row.itemsJson), payment: { status: 'paid', paymentId: 'pay_reference' } });
  expect(message).toContain('Paid via Razorpay');
  expect(message).toContain('pay_reference');
  expect(message).toContain('Order total:');
});

test('CustomerPayment renders pay action with order total and WhatsApp alternative for unpaid order', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomerPayment } = await import('../src/components/CustomerPayment.tsx');
  const props = {
    orderId: row.id,
    total: row.total,
    customerName: 'Ananya',
    email: 'ananya@example.test',
    whatsAppUrl: 'https://wa.me/919876543210?text=Order',
  };
  const html = renderToStaticMarkup(createElement(CustomerPayment, props));
  expect(html).toContain('Pay ₹2,650 online');
  expect(html).toContain('Complete on WhatsApp instead');
  expect(html).toContain('https://wa.me/919876543210?text=Order');
  expect(html).toContain('customer-payment');
});

test('CustomerPayment renders confirmed status and payment ID when order is paid', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomerPayment } = await import('../src/components/CustomerPayment.tsx');
  const props = {
    orderId: row.id,
    total: row.total,
    customerName: 'Ananya',
    payment: { provider: 'razorpay', status: 'paid', razorpayOrderId: 'order_gw', paymentId: 'pay_cust_999' },
  };
  const html = renderToStaticMarkup(createElement(CustomerPayment, props));
  expect(html).toContain('Payment confirmed');
  expect(html).toContain('pay_cust_999');
  expect(html).not.toContain('<button');
});

test('CustomerPayment renders processing status for authorized payments awaiting webhook capture', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomerPayment } = await import('../src/components/CustomerPayment.tsx');
  const props = {
    orderId: row.id,
    total: row.total,
    customerName: 'Ananya',
    payment: { provider: 'razorpay', status: 'authorized', razorpayOrderId: 'order_gw' },
  };
  const html = renderToStaticMarkup(createElement(CustomerPayment, props));
  expect(html).toContain('Check payment status');
});

test('Customer Razorpay options restrict checkout to UPI and debit cards and hide netbanking, wallet, emi, paylater', async () => {
  const { CUSTOMER_RAZORPAY_CONFIG, buildCustomerRazorpayOptions } = await import('../src/lib/razorpay.ts');
  const { CUSTOMER_RAZORPAY_CONFIG: fromComponent, buildCustomerRazorpayOptions: fromComponentBuilder } = await import('../src/components/CustomerPayment.tsx');

  expect(CUSTOMER_RAZORPAY_CONFIG).toBeDefined();
  expect(fromComponent).toBe(CUSTOMER_RAZORPAY_CONFIG);
  expect(fromComponentBuilder).toBe(buildCustomerRazorpayOptions);

  const display = CUSTOMER_RAZORPAY_CONFIG.display;
  expect(display).toBeDefined();

  // Assert block definition
  expect(display.blocks.upi_debit).toBeDefined();
  expect(display.blocks.upi_debit.name).toBe('Pay via UPI or Debit card');
  expect(display.blocks.upi_debit.instruments).toEqual([
    { method: 'upi' },
    { method: 'card', types: ['debit'] },
  ]);

  // Assert sequence and preferences
  expect(display.sequence).toEqual(['block.upi_debit']);
  expect(display.preferences.show_default_blocks).toBe(false);

  // Assert hidden methods
  expect(display.hide).toEqual([
    { method: 'netbanking' },
    { method: 'wallet' },
    { method: 'emi' },
    { method: 'cardless_emi' },
    { method: 'paylater' },
  ]);

  // Assert options builder attaches config.display to options
  const built = buildCustomerRazorpayOptions({
    key: 'rzp_test_123',
    order_id: 'order_gw_456',
    amount: 265000,
    currency: 'INR',
    name: 'Varnam Saree',
    description: 'Order VRN-test',
    prefill: { name: 'Ananya', email: 'ananya@example.test', contact: '9876543210' },
  });

  expect(built.key).toBe('rzp_test_123');
  expect(built.order_id).toBe('order_gw_456');
  expect(built.amount).toBe(265000);
  expect(built.config).toEqual(CUSTOMER_RAZORPAY_CONFIG);
  expect(built.config.display.blocks.upi_debit.instruments).toEqual([
    { method: 'upi' },
    { method: 'card', types: ['debit'] },
  ]);
  expect(built.config.display.hide.map((h) => h.method)).toEqual([
    'netbanking', 'wallet', 'emi', 'cardless_emi', 'paylater'
  ]);
});

