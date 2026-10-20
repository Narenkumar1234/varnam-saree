import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  customerFacingOrderStatus,
  paymentDisplayStatus,
  studioPaidLabel,
} from '../src/lib/order-status.ts';
import {
  createOfflinePaidPayment,
  isOfflinePaymentMethod,
  normalizeOfflinePaymentNote,
  offlinePaidRequiredToUndo,
  razorpayPaidBlocksOffline,
  writePaymentSnapshot,
} from '../src/lib/offline-payment.ts';

const items = [{ id: 1, qty: 1, finish: 'Included' }];
const pricing = { subtotal: 2500, shipping: 0, discountAmount: 0, total: 2500 };

test('offline snapshot write preserves items/pricing and records paid metadata', () => {
  const itemsJson = JSON.stringify({ version: 1, items, pricing });
  const payment = createOfflinePaidPayment({
    method: 'UPI',
    note: 'GPay 8821',
    adminEmail: 'owner@varnam.test',
    paidAt: '2026-10-20T10:00:00.000Z',
  });
  expect(payment).toEqual({
    provider: 'offline',
    status: 'paid',
    method: 'UPI',
    note: 'GPay 8821',
    paidAt: '2026-10-20T10:00:00.000Z',
    adminEmail: 'owner@varnam.test',
  });

  const written = JSON.parse(writePaymentSnapshot(itemsJson, payment));
  expect(written.items).toEqual(items);
  expect(written.pricing).toEqual(pricing);
  expect(written.payment).toEqual(payment);

  const cleared = JSON.parse(writePaymentSnapshot(JSON.stringify(written), null));
  expect(cleared.payment).toBeUndefined();
  expect(cleared.items).toEqual(items);
  expect(cleared.pricing).toEqual(pricing);

  const fromLegacyArray = JSON.parse(writePaymentSnapshot(JSON.stringify(items), payment));
  expect(fromLegacyArray.items).toEqual(items);
  expect(fromLegacyArray.payment.status).toBe('paid');
});

test('razorpay-paid orders cannot be marked offline; only offline paid can be undone', () => {
  expect(razorpayPaidBlocksOffline({ provider: 'razorpay', status: 'paid' })).toContain('already paid online');
  expect(razorpayPaidBlocksOffline({ provider: 'razorpay', status: 'pending' })).toBeNull();
  expect(razorpayPaidBlocksOffline({ provider: 'offline', status: 'paid' })).toBeNull();
  expect(razorpayPaidBlocksOffline(undefined)).toBeNull();

  expect(offlinePaidRequiredToUndo({ provider: 'offline', status: 'paid' })).toBeNull();
  expect(offlinePaidRequiredToUndo({ provider: 'razorpay', status: 'paid' })).toContain('Only offline');
  expect(offlinePaidRequiredToUndo(undefined)).toContain('Only offline');
});

test('offline method and note validation', () => {
  expect(isOfflinePaymentMethod('Cash')).toBe(true);
  expect(isOfflinePaymentMethod('UPI')).toBe(true);
  expect(isOfflinePaymentMethod('Bank transfer')).toBe(true);
  expect(isOfflinePaymentMethod('Other')).toBe(true);
  expect(isOfflinePaymentMethod('Cheque')).toBe(false);
  expect(normalizeOfflinePaymentNote('  ref  ')).toBe('ref');
  expect(normalizeOfflinePaymentNote('')).toBe('');
  expect(normalizeOfflinePaymentNote(null)).toBe('');
  expect(normalizeOfflinePaymentNote(1)).toBeNull();
  expect(normalizeOfflinePaymentNote('x'.repeat(201))).toBeNull();
});

test('customer helpers treat offline-paid orders as paid', () => {
  expect(paymentDisplayStatus({ provider: 'offline', status: 'paid', method: 'Cash' })).toBe('Paid');
  expect(customerFacingOrderStatus('Handloom Finishing')).toBe('Handloom Finishing');
  expect(customerFacingOrderStatus('')).toBe('Confirmed');
  expect(studioPaidLabel({ provider: 'offline', status: 'paid', method: 'UPI' })).toBe('Paid · Offline (UPI)');
  expect(studioPaidLabel({ provider: 'razorpay', status: 'paid' })).toBe('Paid · Razorpay');
  expect(studioPaidLabel({ provider: 'razorpay', status: 'pending' })).toBeNull();
});

test('Studio offline payment UI has confirm and unpaid actions, not Razorpay checkout', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StudioOfflinePayment } = await import('../src/components/StudioOfflinePayment.tsx');
  const props = { orderId: 'VRN-1', adminFetch: async () => new Response('{}'), onUpdated() {} };
  expect(renderToStaticMarkup(createElement(StudioOfflinePayment, props))).toContain('Mark as paid (offline)');
  expect(renderToStaticMarkup(createElement(StudioOfflinePayment, props))).not.toContain('Razorpay');
  expect(renderToStaticMarkup(createElement(StudioOfflinePayment, {
    ...props,
    payment: { provider: 'offline', status: 'paid', method: 'UPI' },
  }))).toContain('Paid · Offline (UPI)');
  expect(renderToStaticMarkup(createElement(StudioOfflinePayment, {
    ...props,
    payment: { provider: 'offline', status: 'paid', method: 'Cash' },
  }))).toContain('Mark unpaid');
  expect(renderToStaticMarkup(createElement(StudioOfflinePayment, {
    ...props,
    payment: { provider: 'razorpay', status: 'paid', razorpayOrderId: 'order_1' },
  }))).toContain('Paid · Razorpay');
  expect(renderToStaticMarkup(createElement(StudioOfflinePayment, {
    ...props,
    payment: { provider: 'razorpay', status: 'paid', razorpayOrderId: 'order_1' },
  }))).not.toContain('Mark unpaid');
});

test('customer order surfaces use shared paid/status helpers', () => {
  const files = [
    '../src/components/AccountView.tsx',
    '../src/app/track/page.tsx',
    '../src/app/orders/page.tsx',
  ];
  const account = readFileSync(fileURLToPath(new URL(files[0], import.meta.url)), 'utf8');
  const track = readFileSync(fileURLToPath(new URL(files[1], import.meta.url)), 'utf8');
  const orders = readFileSync(fileURLToPath(new URL(files[2], import.meta.url)), 'utf8');
  expect(account).toContain('customerFacingOrderStatus');
  expect(account).toContain('paymentDisplayStatus');
  expect(track).toContain('customerFacingOrderStatus');
  expect(track).toContain('paymentDisplayStatus');
  expect(orders).toContain('AccountView');
});
