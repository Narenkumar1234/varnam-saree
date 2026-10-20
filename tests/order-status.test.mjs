import { expect, test } from 'bun:test';
import {
  accountOrderStatusLine,
  customerFacingOrderStatus,
  customerPaymentLabel,
  orderPaymentLabel,
  paymentDisplayStatus,
  publicPaymentSnapshot,
  trackingConfirmStepComplete,
} from '../src/lib/order-status.ts';

const pending = { provider: 'razorpay', status: 'pending', razorpayOrderId: 'order_1', amount: 250000, currency: 'INR' };
const authorized = { ...pending, status: 'authorized', paymentId: 'pay_1' };
const paid = { ...authorized, status: 'paid', paidAt: '2026-10-20T10:00:00.000Z' };
const offlinePaid = { provider: 'offline', status: 'paid', method: 'UPI', note: 'secret', adminEmail: 'owner@varnam.test' };

test('unpaid and missing payment snapshots show awaiting payment, not the DB fulfilment status', () => {
  expect(customerFacingOrderStatus('Confirmed')).toBe('Awaiting payment');
  expect(customerFacingOrderStatus('Confirmed', pending)).toBe('Awaiting payment');
  expect(customerFacingOrderStatus('Dispatched', pending)).toBe('Awaiting payment');
  expect(customerFacingOrderStatus('', null)).toBe('Awaiting payment');
  expect(orderPaymentLabel(undefined)).toBe('Awaiting payment');
  expect(orderPaymentLabel(pending)).toBe('Awaiting payment');
  expect(paymentDisplayStatus(pending)).toBe('unpaid');
});

test('authorized payments show processing until capture, then the fulfilment status once paid', () => {
  expect(customerFacingOrderStatus('Confirmed', authorized)).toBe('Payment processing');
  expect(orderPaymentLabel(authorized)).toBe('Payment processing');
  expect(customerFacingOrderStatus('Confirmed', paid)).toBe('Confirmed');
  expect(customerFacingOrderStatus('Handloom Finishing', paid)).toBe('Handloom Finishing');
  expect(customerFacingOrderStatus('Dispatched', paid)).toBe('Dispatched');
  expect(customerFacingOrderStatus(undefined, paid)).toBe('Confirmed');
  expect(orderPaymentLabel(paid)).toBe('Paid');
  expect(paymentDisplayStatus(paid)).toBe('paid');
});

test('cancelled orders keep their fulfilment status regardless of payment', () => {
  expect(customerFacingOrderStatus('Cancelled', pending)).toBe('Cancelled');
  expect(customerFacingOrderStatus('cancelled', paid)).toBe('cancelled');
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
});

test('offline-paid snapshots are paid, including the method on customer labels', () => {
  expect(paymentDisplayStatus(offlinePaid)).toBe('paid');
  expect(customerFacingOrderStatus('Confirmed', offlinePaid)).toBe('Confirmed');
  expect(customerFacingOrderStatus('Handloom Finishing', offlinePaid)).toBe('Handloom Finishing');
  expect(customerPaymentLabel(undefined)).toBe('Awaiting payment');
  expect(customerPaymentLabel(pending)).toBe('Awaiting payment');
  expect(customerPaymentLabel(authorized)).toBe('Payment processing');
  expect(customerPaymentLabel(paid)).toBe('Paid');
  expect(customerPaymentLabel(offlinePaid)).toBe('Paid · Offline (UPI)');
  expect(customerPaymentLabel({ provider: 'offline', status: 'paid' })).toBe('Paid · Offline');
  expect(accountOrderStatusLine('Confirmed')).toBe('Awaiting payment');
  expect(accountOrderStatusLine('Confirmed', pending)).toBe('Awaiting payment');
  expect(accountOrderStatusLine('Confirmed', paid)).toBe('Confirmed · Paid');
  expect(accountOrderStatusLine('Confirmed', offlinePaid)).toBe('Confirmed · Paid · Offline (UPI)');
  expect(accountOrderStatusLine('Handloom Finishing', paid)).toBe('Handloom Finishing · Paid');
  expect(accountOrderStatusLine('Cancelled', pending)).toBe('Cancelled');
  expect(accountOrderStatusLine('Cancelled', offlinePaid)).toBe('Cancelled');
});
