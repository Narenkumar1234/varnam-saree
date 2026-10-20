import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  loadTrackedOrder,
  resolveDisplayedTrackedOrder,
  shouldUpdateLocalOrderPayment,
  toPublicTrackedOrder,
} from '../src/lib/order-lookup.ts';
import { TrackedOrderView } from '../src/components/TrackedOrderView.tsx';

const routeSource = readFileSync(fileURLToPath(new URL('../src/app/api/orders/[id]/route.ts', import.meta.url)), 'utf8');
const trackSource = readFileSync(fileURLToPath(new URL('../src/app/track/page.tsx', import.meta.url)), 'utf8');
const lookupSource = readFileSync(fileURLToPath(new URL('../src/lib/order-lookup.ts', import.meta.url)), 'utf8');
const render = (order) => renderToStaticMarkup(createElement(TrackedOrderView, { order }));
const plainText = (markup) => markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

const paid = { status: 'paid' };
const pending = { status: 'pending' };
const authorized = { status: 'authorized' };
const offlinePaid = { status: 'paid', provider: 'offline', method: 'UPI' };

test('the public lookup route and track page use the sanitised payload helpers', () => {
  expect(routeSource).toContain('toPublicTrackedOrder');
  expect(routeSource).not.toContain('...order');
  expect(routeSource).not.toContain('readOrderSnapshot');
  expect(trackSource).toContain('TrackedOrderView');
  expect(trackSource).toContain('loadTrackedOrder');
  expect(trackSource).toContain("currentLookup?.status === 'found' ? currentLookup.order : localOrder");
  expect(trackSource).not.toContain('localOrder || currentLookup?.order');
  expect(trackSource).toContain('shouldUpdateLocalOrderPayment(localOrder, order.payment)');
  expect(trackSource).toContain('name: localOrder?.name');
  expect(lookupSource).toContain("cache: 'no-store'");
  expect(trackSource).not.toContain('if (localOrder) { setLookup({ id: searchedId, status: \'found\', order: localOrder }); return; }');
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
    payment: { status: 'authorized', provider: 'razorpay' },
  });
  expect(JSON.stringify(publicOrder)).not.toContain('order_secret');
  expect(JSON.stringify(publicOrder)).not.toContain('pay_secret');
});

test('unpaid tracked orders show awaiting payment, no completed step, and Pay now', () => {
  const markup = render({ id: 'VRN-1', total: 4000, status: 'Confirmed' });
  expect(plainText(markup)).toContain('Awaiting payment');
  expect(markup).toContain('Pay now');
  expect(markup).not.toContain('track-step current');
  expect(markup).toContain('1. Order placed');
  expect(markup).toContain('2. Confirmed (paid)');
  expect(markup).toContain('3. Delivered');
  expect(markup).not.toContain('Handloom finishing');
  expect(markup).not.toContain('Dispatched');
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
  expect(plainText(markup)).toContain('1. Order placed');
  expect(plainText(markup)).toContain('2. Confirmed (paid)');
  expect(plainText(markup)).toContain('Confirmed · Paid');
  expect(plainText(markup)).not.toContain('Awaiting payment');
  expect(plainText(markup)).not.toContain('Pay now');
  expect(plainText(markup)).not.toContain('Retry payment');
  expect(plainText(markup)).not.toContain('Complete on WhatsApp');
});

test('offline-paid tracked orders show the method, complete confirm, and hide Pay now / WhatsApp', () => {
  const markup = render({ id: 'VRN-1', total: 4000, status: 'Confirmed', payment: offlinePaid });
  expect(plainText(markup)).toContain('Paid · Offline (UPI)');
  expect(markup).toContain('track-step current');
  expect(plainText(markup)).not.toContain('Awaiting payment');
  expect(plainText(markup)).not.toContain('Pay now');
  expect(plainText(markup)).not.toContain('Complete on WhatsApp');
  expect(plainText(markup)).not.toContain('Retry payment');

  const unpaid = render({ id: 'VRN-1', total: 4000, status: 'Confirmed' });
  expect(plainText(unpaid)).toContain('Awaiting payment');
  expect(unpaid).toContain('Pay now');
  expect(unpaid).toContain('Complete on WhatsApp instead');
});

test('local unpaid snapshot yields to a server offline-paid lookup', () => {
  const localOrder = { id: 'VRN-1', total: 4000, status: 'Confirmed', name: 'Meera' };
  const serverOrder = { id: 'VRN-1', total: 4000, status: 'Confirmed', payment: offlinePaid };
  const placeholder = resolveDisplayedTrackedOrder({ status: 'loading' }, localOrder);
  expect(placeholder).toEqual(localOrder);
  expect(shouldUpdateLocalOrderPayment(localOrder, placeholder.payment)).toBe(true);

  const displayed = resolveDisplayedTrackedOrder({ status: 'found', order: serverOrder }, localOrder);
  expect(displayed).toBe(serverOrder);
  expect(shouldUpdateLocalOrderPayment(localOrder, displayed.payment)).toBe(false);

  const markup = render({ ...displayed, name: localOrder.name });
  expect(plainText(markup)).toContain('Paid · Offline (UPI)');
  expect(markup).toContain('track-step current');
  expect(plainText(markup)).not.toContain('Awaiting payment');
  expect(plainText(markup)).not.toContain('Pay now');
  expect(plainText(markup)).not.toContain('Complete on WhatsApp');
});

test('loadTrackedOrder fetches with cache no-store', async () => {
  const previous = globalThis.fetch;
  let options;
  globalThis.fetch = async (_url, init) => {
    options = init;
    return Response.json({
      order: { id: 'VRN-1', total: 4000, status: 'Confirmed', payment: offlinePaid },
    });
  };
  try {
    const order = await loadTrackedOrder('VRN-1');
    expect(options.cache).toBe('no-store');
    expect(order.payment).toEqual(offlinePaid);
  } finally {
    globalThis.fetch = previous;
  }
});

test('cancelled orders stay cancelled even when a payment snapshot exists', () => {
  const markup = render({ id: 'VRN-1', total: 4000, status: 'Cancelled', payment: pending });
  expect(plainText(markup)).toContain('Cancelled');
  expect(markup).not.toContain('track-step current');
  expect(plainText(markup)).not.toContain('Pay now');
  expect(plainText(markup)).not.toContain('Retry payment');
});
