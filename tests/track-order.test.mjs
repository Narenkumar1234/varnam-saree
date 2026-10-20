import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { toPublicTrackedOrder } from '../src/lib/order-lookup.ts';
import { TrackedOrderView } from '../src/components/TrackedOrderView.tsx';

const routeSource = readFileSync(fileURLToPath(new URL('../src/app/api/orders/[id]/route.ts', import.meta.url)), 'utf8');
const trackSource = readFileSync(fileURLToPath(new URL('../src/app/track/page.tsx', import.meta.url)), 'utf8');
const render = (order) => renderToStaticMarkup(createElement(TrackedOrderView, { order }));
const plainText = (markup) => markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

const paid = { status: 'paid' };
const pending = { status: 'pending' };
const authorized = { status: 'authorized' };

test('the public lookup route and track page use the sanitised payload helpers', () => {
  expect(routeSource).toContain('toPublicTrackedOrder');
  expect(routeSource).not.toContain('...order');
  expect(routeSource).not.toContain('readOrderSnapshot');
  expect(trackSource).toContain('TrackedOrderView');
});

test('toPublicTrackedOrder keeps status and payment status, never Razorpay secrets', () => {
  const publicOrder = toPublicTrackedOrder({
    id: 'VRN-1',
    total: 2500,
    status: 'Confirmed',
    createdAt: new Date('2026-10-20T10:00:00.000Z'),
    itemsJson: JSON.stringify({
      version: 1,
      items: [{ id: 1, qty: 1 }],
      pricing: { subtotal: 2500, discountAmount: 0, shipping: 0, total: 2500 },
      payment: {
        provider: 'razorpay', status: 'authorized', razorpayOrderId: 'order_secret',
        amount: 250000, currency: 'INR', paymentId: 'pay_secret',
      },
    }),
  });
  expect(publicOrder).toEqual({
    id: 'VRN-1',
    total: 2500,
    status: 'Confirmed',
    createdAt: '2026-10-20T10:00:00.000Z',
    pricing: { subtotal: 2500, discountAmount: 0, shipping: 0, total: 2500 },
    payment: { status: 'authorized' },
  });
  expect(JSON.stringify(publicOrder)).not.toContain('order_secret');
  expect(JSON.stringify(publicOrder)).not.toContain('pay_secret');
});

test('unpaid tracked orders show awaiting payment, no completed step, and Pay now', () => {
  const markup = render({ id: 'VRN-1', total: 4000, status: 'Confirmed' });
  expect(plainText(markup)).toContain('Awaiting payment');
  expect(markup).toContain('Pay now');
  expect(markup).not.toContain('track-step current');
  expect(markup).toContain('1. Order confirmed');
});

test('pending payment snapshots offer Retry payment instead of marking confirmed done', () => {
  const markup = render({ id: 'VRN-1', total: 4000, status: 'Confirmed', payment: pending });
  expect(plainText(markup)).toContain('Awaiting payment');
  expect(markup).toContain('Retry payment');
  expect(markup).not.toContain('Pay now');
  expect(markup).not.toContain('track-step current');
});

test('authorized orders show payment processing and do not complete the timeline', () => {
  const markup = render({ id: 'VRN-1', total: 4000, status: 'Confirmed', payment: authorized });
  expect(plainText(markup)).toContain('Payment processing');
  expect(markup).not.toContain('track-step current');
  expect(markup).toContain('Check payment status');
});

test('paid orders mark order confirmed current and hide the pay call to action', () => {
  const markup = render({ id: 'VRN-1', total: 4000, status: 'Confirmed', payment: paid });
  expect(markup).toContain('track-step current');
  expect(plainText(markup)).toContain('1. Order confirmed');
  expect(plainText(markup)).not.toContain('Awaiting payment');
  expect(plainText(markup)).not.toContain('Pay now');
  expect(plainText(markup)).not.toContain('Retry payment');
});

test('cancelled orders stay cancelled even when a payment snapshot exists', () => {
  const markup = render({ id: 'VRN-1', total: 4000, status: 'Cancelled', payment: pending });
  expect(plainText(markup)).toContain('Cancelled');
  expect(markup).not.toContain('track-step current');
  expect(plainText(markup)).not.toContain('Pay now');
  expect(plainText(markup)).not.toContain('Retry payment');
});
