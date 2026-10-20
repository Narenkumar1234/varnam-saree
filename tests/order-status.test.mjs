import { expect, test } from 'bun:test';
import {
  accountOrderStatusLine,
  adminStatusChangeError,
  customerFacingOrderStatus,
  customerPaymentLabel,
  deriveOrderStatusFromPayment,
  formatOrderCreatedAtIst,
  lookupOrderById,
  normalizeOrderLookupId,
  normalizeOrderStatus,
  normalizeStudioOrderLookupId,
  studioAdminPaymentDetails,
  ORDER_STATUSES,
  orderPaymentLabel,
  paymentDisplayStatus,
  publicPaymentSnapshot,
  trackingConfirmStepComplete,
  trackingDeliveredStepComplete,
} from '../src/lib/order-status.ts';

const pending = { provider: 'razorpay', status: 'pending', razorpayOrderId: 'order_1', amount: 250000, currency: 'INR' };
const authorized = { ...pending, status: 'authorized', paymentId: 'pay_1' };
const paid = { ...authorized, status: 'paid', paidAt: '2026-10-20T10:00:00.000Z' };
const offlinePaid = { provider: 'offline', status: 'paid', method: 'UPI', note: 'secret', adminEmail: 'owner@varnam.test' };

test('the live status set is Payment pending, Confirmed, Delivered, Cancelled', () => {
  expect([...ORDER_STATUSES]).toEqual(['Payment pending', 'Confirmed', 'Delivered', 'Cancelled']);
});

test('normalisation maps legacy and unpaid Confirmed rows onto the four statuses', () => {
  expect(normalizeOrderStatus(undefined)).toBe('Payment pending');
  expect(normalizeOrderStatus('')).toBe('Payment pending');
  expect(normalizeOrderStatus('Confirmed')).toBe('Payment pending');
  expect(normalizeOrderStatus('Confirmed', pending)).toBe('Payment pending');
  expect(normalizeOrderStatus('Confirmed', paid)).toBe('Confirmed');
  expect(normalizeOrderStatus('Handloom Finishing', paid)).toBe('Confirmed');
  expect(normalizeOrderStatus('Dispatched', paid)).toBe('Confirmed');
  expect(normalizeOrderStatus('  Dispatched  ', pending)).toBe('Payment pending');
  expect(normalizeOrderStatus('Handloom Finishing')).toBe('Payment pending');
  expect(normalizeOrderStatus('Payment pending', paid)).toBe('Confirmed');
  expect(normalizeOrderStatus('Delivered', pending)).toBe('Delivered');
  expect(normalizeOrderStatus('Cancelled', paid)).toBe('Cancelled');
  expect(normalizeOrderStatus('cancelled')).toBe('Cancelled');
});

test('derivation from payment leaves Delivered and Cancelled alone', () => {
  expect(deriveOrderStatusFromPayment(undefined)).toBe('Payment pending');
  expect(deriveOrderStatusFromPayment('Confirmed', pending)).toBe('Payment pending');
  expect(deriveOrderStatusFromPayment('Payment pending', paid)).toBe('Confirmed');
  expect(deriveOrderStatusFromPayment('Handloom Finishing', paid)).toBe('Confirmed');
  expect(deriveOrderStatusFromPayment('Dispatched', offlinePaid)).toBe('Confirmed');
  expect(deriveOrderStatusFromPayment('Confirmed', null)).toBe('Payment pending');
  expect(deriveOrderStatusFromPayment('Delivered', pending)).toBe('Delivered');
  expect(deriveOrderStatusFromPayment('Cancelled', paid)).toBe('Cancelled');
});

test('admin cannot set Confirmed on an unpaid order or Payment pending on a paid one', () => {
  expect(adminStatusChangeError('Payment pending', 'Confirmed')).toContain('Mark the order as paid');
  expect(adminStatusChangeError('Confirmed', 'Confirmed', pending)).toContain('Mark the order as paid');
  expect(adminStatusChangeError('Confirmed', 'Payment pending', paid)).toContain('Mark the order unpaid');
  expect(adminStatusChangeError('Payment pending', 'Delivered')).toContain('Only confirmed');
  expect(adminStatusChangeError('Confirmed', 'Delivered', paid)).toBeNull();
  expect(adminStatusChangeError('Confirmed', 'Cancelled', paid)).toBeNull();
  expect(adminStatusChangeError('Payment pending', 'Cancelled')).toBeNull();
  expect(adminStatusChangeError('Delivered', 'Confirmed', paid)).toBeNull();
  expect(adminStatusChangeError('Cancelled', 'Payment pending')).toBeNull();
  expect(adminStatusChangeError('Confirmed', 'Dispatched', paid)).toContain('Choose Payment pending');
});

test('unpaid and missing payment snapshots show awaiting payment, not the DB fulfilment status', () => {
  expect(customerFacingOrderStatus('Confirmed')).toBe('Awaiting payment');
  expect(customerFacingOrderStatus('Confirmed', pending)).toBe('Awaiting payment');
  expect(customerFacingOrderStatus('Dispatched', pending)).toBe('Awaiting payment');
  expect(customerFacingOrderStatus('', null)).toBe('Awaiting payment');
  expect(orderPaymentLabel(undefined)).toBe('Awaiting payment');
  expect(orderPaymentLabel(pending)).toBe('Awaiting payment');
  expect(paymentDisplayStatus(pending)).toBe('unpaid');
});

test('authorized payments show processing until capture, then Confirmed once paid', () => {
  expect(customerFacingOrderStatus('Confirmed', authorized)).toBe('Payment processing');
  expect(orderPaymentLabel(authorized)).toBe('Payment processing');
  expect(customerFacingOrderStatus('Confirmed', paid)).toBe('Confirmed');
  expect(customerFacingOrderStatus('Handloom Finishing', paid)).toBe('Confirmed');
  expect(customerFacingOrderStatus('Dispatched', paid)).toBe('Confirmed');
  expect(customerFacingOrderStatus(undefined, paid)).toBe('Confirmed');
  expect(customerFacingOrderStatus('Delivered', paid)).toBe('Delivered');
  expect(orderPaymentLabel(paid)).toBe('Paid');
  expect(paymentDisplayStatus(paid)).toBe('paid');
});

test('cancelled orders keep their fulfilment status regardless of payment', () => {
  expect(customerFacingOrderStatus('Cancelled', pending)).toBe('Cancelled');
  expect(customerFacingOrderStatus('cancelled', paid)).toBe('Cancelled');
  expect(orderPaymentLabel(pending)).toBe('Awaiting payment');
});

test('public payment snapshots expose status, provider and offline method — never secrets', () => {
  expect(publicPaymentSnapshot(pending)).toEqual({ status: 'pending', provider: 'razorpay' });
  expect(publicPaymentSnapshot(authorized)).toEqual({ status: 'authorized', provider: 'razorpay' });
  expect(publicPaymentSnapshot(paid)).toEqual({ status: 'paid', provider: 'razorpay' });
  expect(publicPaymentSnapshot(offlinePaid)).toEqual({ status: 'paid', provider: 'offline', method: 'UPI' });
  expect(publicPaymentSnapshot({ status: 'paid' })).toEqual({ status: 'paid' });
  expect(publicPaymentSnapshot(undefined)).toBeUndefined();
  expect(publicPaymentSnapshot({ status: 'refunded' })).toBeUndefined();
  expect(JSON.stringify(publicPaymentSnapshot(offlinePaid))).not.toContain('secret');
  expect(JSON.stringify(publicPaymentSnapshot(offlinePaid))).not.toContain('owner@varnam.test');
  expect(JSON.stringify(publicPaymentSnapshot(paid))).not.toContain('order_1');
  expect(JSON.stringify(publicPaymentSnapshot(paid))).not.toContain('pay_1');
});

test('the tracking confirm step is done only for paid, non-cancelled orders', () => {
  expect(trackingConfirmStepComplete('Confirmed')).toBe(false);
  expect(trackingConfirmStepComplete('Confirmed', pending)).toBe(false);
  expect(trackingConfirmStepComplete('Confirmed', authorized)).toBe(false);
  expect(trackingConfirmStepComplete('Confirmed', paid)).toBe(true);
  expect(trackingConfirmStepComplete('Confirmed', offlinePaid)).toBe(true);
  expect(trackingConfirmStepComplete('Handloom Finishing', paid)).toBe(true);
  expect(trackingConfirmStepComplete('Cancelled', paid)).toBe(false);
  expect(trackingConfirmStepComplete('cancelled', pending)).toBe(false);
  expect(trackingDeliveredStepComplete('Confirmed', paid)).toBe(false);
  expect(trackingDeliveredStepComplete('Delivered', paid)).toBe(true);
});

test('account and track lines use Awaiting payment / Confirmed · Paid · method', () => {
  expect(paymentDisplayStatus(offlinePaid)).toBe('paid');
  expect(customerFacingOrderStatus('Confirmed', offlinePaid)).toBe('Confirmed');
  expect(customerFacingOrderStatus('Handloom Finishing', offlinePaid)).toBe('Confirmed');
  expect(customerPaymentLabel(undefined)).toBe('Awaiting payment');
  expect(customerPaymentLabel(pending)).toBe('Awaiting payment');
  expect(customerPaymentLabel(authorized)).toBe('Payment processing');
  expect(customerPaymentLabel(paid)).toBe('Paid · Razorpay');
  expect(customerPaymentLabel(offlinePaid)).toBe('Paid · Offline (UPI)');
  expect(customerPaymentLabel({ provider: 'offline', status: 'paid' })).toBe('Paid · Offline');
  expect(accountOrderStatusLine('Confirmed')).toBe('Awaiting payment');
  expect(accountOrderStatusLine('Confirmed', pending)).toBe('Awaiting payment');
  expect(accountOrderStatusLine('Confirmed', paid)).toBe('Confirmed · Paid · Razorpay');
  expect(accountOrderStatusLine('Confirmed', offlinePaid)).toBe('Confirmed · Paid · Offline (UPI)');
  expect(accountOrderStatusLine('Handloom Finishing', paid)).toBe('Confirmed · Paid · Razorpay');
  expect(accountOrderStatusLine('Confirmed', { status: 'paid' })).toBe('Confirmed · Paid');
  expect(accountOrderStatusLine('Delivered', paid)).toBe('Delivered');
  expect(accountOrderStatusLine('Cancelled', pending)).toBe('Cancelled');
  expect(accountOrderStatusLine('Cancelled', offlinePaid)).toBe('Cancelled');
});

test('order lookup ids are trimmed and reject blanks', () => {
  expect(normalizeOrderLookupId('  VRN-1042  ')).toBe('VRN-1042');
  expect(normalizeOrderLookupId('vrn-1042')).toBe('vrn-1042');
  expect(normalizeOrderLookupId('   ')).toBeNull();
  expect(normalizeOrderLookupId('')).toBeNull();
  expect(normalizeOrderLookupId(null)).toBeNull();
  expect(normalizeStudioOrderLookupId('  vrn-0692abcd  ')).toBe('VRN-0692ABCD');
  expect(normalizeStudioOrderLookupId('   ')).toBeNull();
});

test('order lookup always falls back to a case-insensitive match, including lowercase input', async () => {
  const stored = { id: 'VRN-0692abcd-ef' };
  let foldedId;
  expect(await lookupOrderById('vrn-0692abcd-ef', async () => null, async (id) => {
    foldedId = id;
    return stored;
  })).toEqual(stored);
  expect(foldedId).toBe('vrn-0692abcd-ef');

  let foldedCalls = 0;
  expect(await lookupOrderById('VRN-0692abcd-ef', async () => stored, async () => {
    foldedCalls += 1;
    return null;
  })).toEqual(stored);
  expect(foldedCalls).toBe(0);

  expect(await lookupOrderById('vrn-missing', async () => null, async () => null)).toBeNull();
});

test('Studio admin payment details expose method, Razorpay id, paid date and offline note', () => {
  expect(studioAdminPaymentDetails(undefined)).toEqual({
    status: 'Awaiting payment',
    provider: null,
    paymentId: null,
    paidAt: null,
    note: null,
  });
  expect(studioAdminPaymentDetails({
    provider: 'razorpay',
    status: 'paid',
    paymentId: 'pay_secret',
    paidAt: '2026-10-20T06:30:00.000Z',
  })).toMatchObject({
    status: 'Paid',
    provider: 'Razorpay',
    paymentId: 'pay_secret',
    note: null,
  });
  expect(studioAdminPaymentDetails({
    provider: 'offline',
    status: 'paid',
    method: 'UPI',
    note: 'GPay 8821',
    paidAt: '2026-10-20T06:30:00.000Z',
    adminEmail: 'owner@varnam.test',
  })).toMatchObject({
    status: 'Paid',
    provider: 'Offline (UPI)',
    paymentId: null,
    note: 'GPay 8821',
  });
});

test('IST formatter uses Asia/Kolkata', () => {
  const formatted = formatOrderCreatedAtIst('2026-10-20T06:30:00.000Z');
  expect(formatted).toContain('2026');
  expect(formatted.toLowerCase()).toMatch(/am|pm|ist|:|oct/);
});
