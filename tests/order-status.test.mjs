import { expect, test } from 'bun:test';
import { customerFacingOrderStatus, orderPaymentLabel, paymentDisplayStatus } from '../src/lib/order-status.ts';

const pending = { provider: 'razorpay', status: 'pending', razorpayOrderId: 'order_1', amount: 250000, currency: 'INR' };
const authorized = { ...pending, status: 'authorized', paymentId: 'pay_1' };
const paid = { ...authorized, status: 'paid', paidAt: '2026-10-20T10:00:00.000Z' };

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
