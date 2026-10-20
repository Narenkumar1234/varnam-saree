import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { customerFacingOrderStatus, paymentDisplayStatus, publicPaymentSnapshot } from '../src/lib/order-status.ts';
import { toPublicTrackedOrder } from '../src/lib/order-lookup.ts';
import { formatOrderAdminMessage } from '../src/lib/telegram.ts';
import {
  createOfflinePaidPayment,
  isOfflinePaymentMethod,
  normalizeOfflinePaymentNote,
  offlinePaidRequiredToUndo,
  offlineTelegramPaymentStatus,
  razorpayPaidBlocksOffline,
  studioPaidLabel,
  UNREADABLE_ORDER_DATA_ERROR,
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

test('unreadable itemsJson throws instead of replacing order lines with an empty array', () => {
  const payment = createOfflinePaidPayment({
    method: 'Cash',
    adminEmail: 'owner@varnam.test',
    paidAt: '2026-10-20T10:00:00.000Z',
  });
  expect(() => writePaymentSnapshot('{not-json', payment)).toThrow(UNREADABLE_ORDER_DATA_ERROR);
  expect(() => writePaymentSnapshot('{not-json', null)).toThrow(UNREADABLE_ORDER_DATA_ERROR);
  expect(() => writePaymentSnapshot('null', payment)).toThrow(UNREADABLE_ORDER_DATA_ERROR);
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
  const offlinePaid = { provider: 'offline', status: 'paid', method: 'Cash', note: 'secret', adminEmail: 'owner@varnam.test' };
  expect(paymentDisplayStatus(offlinePaid)).toBe('paid');
  expect(customerFacingOrderStatus('Handloom Finishing', offlinePaid)).toBe('Handloom Finishing');
  expect(customerFacingOrderStatus('Confirmed', offlinePaid)).toBe('Confirmed');
  expect(customerFacingOrderStatus('')).toBe('Awaiting payment');
  expect(studioPaidLabel({ provider: 'offline', status: 'paid', method: 'UPI' })).toBe('Paid · Offline (UPI)');
  expect(studioPaidLabel({ provider: 'razorpay', status: 'paid' })).toBe('Paid · Razorpay');
  expect(studioPaidLabel({ provider: 'razorpay', status: 'pending' })).toBeNull();
  expect(publicPaymentSnapshot(offlinePaid)).toEqual({ status: 'paid' });
  expect(Object.keys(publicPaymentSnapshot(offlinePaid))).toEqual(['status']);
  expect(offlineTelegramPaymentStatus('UPI')).toBe('paid (offline UPI)');
  const publicOrder = toPublicTrackedOrder({
    id: 'VRN-1042',
    total: 2500,
    status: 'Confirmed',
    itemsJson: writePaymentSnapshot(JSON.stringify({ version: 1, items, pricing }), offlinePaid),
  });
  expect(publicOrder.payment).toEqual({ status: 'paid' });
  expect(JSON.stringify(publicOrder)).not.toContain('adminEmail');
  expect(JSON.stringify(publicOrder)).not.toContain('secret');
  expect(formatOrderAdminMessage({
    id: 'VRN-1042',
    total: 2500,
    customerName: 'Meera',
    email: 'meera@example.com',
    paymentStatus: 'paid (offline UPI)',
  })).toContain('paid (offline UPI)');
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
  const account = readFileSync(fileURLToPath(new URL('../src/components/AccountView.tsx', import.meta.url)), 'utf8');
  const trackView = readFileSync(fileURLToPath(new URL('../src/components/TrackedOrderView.tsx', import.meta.url)), 'utf8');
  const orders = readFileSync(fileURLToPath(new URL('../src/app/orders/page.tsx', import.meta.url)), 'utf8');
  const lookup = readFileSync(fileURLToPath(new URL('../src/lib/order-lookup.ts', import.meta.url)), 'utf8');
  expect(account).toContain('customerFacingOrderStatus(order.status, order.payment)');
  expect(trackView).toContain('customerFacingOrderStatus');
  expect(trackView).toContain('paymentDisplayStatus');
  expect(orders).toContain('AccountView');
  expect(lookup).toContain('publicPaymentSnapshot');
  expect(lookup).toContain('toPublicTrackedOrder');
});
