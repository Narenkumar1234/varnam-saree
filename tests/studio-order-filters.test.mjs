import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { paymentDisplayStatus } from '../src/lib/order-status.ts';
import {
  STUDIO_ORDER_STATUSES,
  STUDIO_PAYMENT_FILTERS,
  countStudioOrdersByPayment,
  countStudioOrdersByStatus,
  createStudioOrderFilters,
  filterStudioOrders,
  hasActiveStudioOrderFilters,
  normalizeStudioOrderStatus,
} from '../src/lib/studio-order-filters.ts';

function order(overrides = {}) {
  return {
    id: 'VRN-1042',
    customerName: 'Meera Iyer',
    email: 'meera@example.com',
    phone: '9876543210',
    status: 'Confirmed',
    payment: null,
    ...overrides,
  };
}

const catalogue = [
  order(),
  order({
    id: 'VRN-1043',
    customerName: 'Arun Patel',
    email: 'arun@example.com',
    phone: '9000011122',
    status: 'Handloom Finishing',
    payment: { status: 'paid' },
  }),
  order({
    id: 'VRN-1044',
    customerName: 'Sana Khan',
    email: 'sana@example.com',
    phone: '+91 88888 77777',
    status: 'Dispatched',
    payment: { status: 'authorized' },
  }),
  order({
    id: 'VRN-1045',
    customerName: 'David Chen',
    email: 'david@example.com',
    phone: null,
    status: 'Delivered',
    payment: { status: 'pending' },
  }),
  order({
    id: 'VRN-1046',
    customerName: 'Priya Nair',
    email: 'priya@example.com',
    phone: '8111122223',
    status: 'Cancelled',
    payment: { status: 'paid' },
  }),
];

test('paymentDisplayStatus maps Razorpay and offline states to shared labels', () => {
  expect(paymentDisplayStatus({ status: 'paid' })).toBe('Paid');
  expect(paymentDisplayStatus({ status: 'paid', provider: 'offline' })).toBe('Paid');
  expect(paymentDisplayStatus({ status: 'authorized' })).toBe('Payment processing');
  expect(paymentDisplayStatus({ status: 'pending' })).toBe('Awaiting payment');
  expect(paymentDisplayStatus(null)).toBe('Awaiting payment');
  expect(paymentDisplayStatus(undefined)).toBe('Awaiting payment');
});

test('status chips use the Studio dropdown values and count empty status as Confirmed', () => {
  expect([...STUDIO_ORDER_STATUSES]).toEqual([
    'Confirmed',
    'Handloom Finishing',
    'Dispatched',
    'Delivered',
    'Cancelled',
  ]);
  expect(normalizeStudioOrderStatus(undefined)).toBe('Confirmed');
  expect(normalizeStudioOrderStatus('')).toBe('Confirmed');
  expect(normalizeStudioOrderStatus('  Dispatched  ')).toBe('Dispatched');

  const counts = countStudioOrdersByStatus([
    ...catalogue,
    order({ id: 'VRN-1047', status: '' }),
  ]);
  expect(counts.All).toBe(6);
  expect(counts.Confirmed).toBe(2);
  expect(counts['Handloom Finishing']).toBe(1);
  expect(counts.Dispatched).toBe(1);
  expect(counts.Delivered).toBe(1);
  expect(counts.Cancelled).toBe(1);
});

test('payment chips count Paid, Awaiting payment and Payment processing', () => {
  expect([...STUDIO_PAYMENT_FILTERS]).toEqual([
    'All',
    'Paid',
    'Awaiting payment',
    'Payment processing',
  ]);
  const counts = countStudioOrdersByPayment(catalogue);
  expect(counts.All).toBe(5);
  expect(counts.Paid).toBe(2);
  expect(counts['Awaiting payment']).toBe(2);
  expect(counts['Payment processing']).toBe(1);
});

test('status, payment and text search combine and stay case-insensitive', () => {
  const defaults = createStudioOrderFilters();
  expect(filterStudioOrders(catalogue, defaults)).toHaveLength(5);

  expect(filterStudioOrders(catalogue, { ...defaults, status: 'Dispatched' }).map((o) => o.id))
    .toEqual(['VRN-1044']);
  expect(filterStudioOrders(catalogue, { ...defaults, payment: 'Paid' }).map((o) => o.id))
    .toEqual(['VRN-1043', 'VRN-1046']);
  expect(filterStudioOrders(catalogue, { ...defaults, query: 'vrn-1042' }).map((o) => o.id))
    .toEqual(['VRN-1042']);
  expect(filterStudioOrders(catalogue, { ...defaults, query: 'MEERA' }).map((o) => o.id))
    .toEqual(['VRN-1042']);
  expect(filterStudioOrders(catalogue, { ...defaults, query: '88888' }).map((o) => o.id))
    .toEqual(['VRN-1044']);
  expect(filterStudioOrders(catalogue, { ...defaults, query: 'priya@example.com' }).map((o) => o.id))
    .toEqual(['VRN-1046']);

  expect(filterStudioOrders(catalogue, {
    status: 'Cancelled',
    payment: 'Paid',
    query: 'priya',
  }).map((o) => o.id)).toEqual(['VRN-1046']);

  expect(filterStudioOrders(catalogue, {
    status: 'Cancelled',
    payment: 'Awaiting payment',
    query: '',
  })).toHaveLength(0);
});

test('changing an order status immediately changes which status filter it matches', () => {
  const defaults = createStudioOrderFilters();
  const confirmed = filterStudioOrders(catalogue, { ...defaults, status: 'Confirmed' });
  expect(confirmed.map((o) => o.id)).toEqual(['VRN-1042']);

  const afterUpdate = catalogue.map((item) => (
    item.id === 'VRN-1042' ? { ...item, status: 'Delivered' } : item
  ));
  expect(filterStudioOrders(afterUpdate, { ...defaults, status: 'Confirmed' })).toHaveLength(0);
  expect(filterStudioOrders(afterUpdate, { ...defaults, status: 'Delivered' }).map((o) => o.id))
    .toEqual(['VRN-1042', 'VRN-1045']);
  expect(countStudioOrdersByStatus(afterUpdate).Delivered).toBe(2);
  expect(countStudioOrdersByStatus(afterUpdate).Confirmed).toBe(0);
});

test('Studio orders UI keeps the status dropdown values and drops WhatsApp confirm', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/app/studio-desk/page.tsx', import.meta.url)), 'utf8');
  expect(source).toContain('No orders match these filters');
  expect(source).toContain('filterStudioOrders');
  expect(source).toContain('STUDIO_ORDER_STATUSES.map');
  expect(source).not.toContain('Confirm on WhatsApp');
  expect(source).not.toContain('createSavedOrderWhatsAppMessage');
  expect(source).not.toContain('confirmOrderOnWhatsApp');
  expect(source).not.toContain('StudioPayment');
  expect(source).not.toContain('Pay ${money(total)} with Razorpay');
  expect(source).toContain('StudioOfflinePayment');
});

test('active-filter helper ignores blank search text', () => {
  expect(hasActiveStudioOrderFilters(createStudioOrderFilters())).toBe(false);
  expect(hasActiveStudioOrderFilters({ ...createStudioOrderFilters(), query: '   ' })).toBe(false);
  expect(hasActiveStudioOrderFilters({ ...createStudioOrderFilters(), status: 'Delivered' })).toBe(true);
  expect(hasActiveStudioOrderFilters({ ...createStudioOrderFilters(), payment: 'Paid' })).toBe(true);
  expect(hasActiveStudioOrderFilters({ ...createStudioOrderFilters(), query: 'meera' })).toBe(true);
});
