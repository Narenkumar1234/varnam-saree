import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeOrderStatus } from '../src/lib/order-status.ts';
import {
  STUDIO_ORDER_FILTER_TABS,
  STUDIO_ORDER_STATUSES,
  countStudioOrdersByStatus,
  createStudioOrderFilters,
  filterStudioOrders,
  hasActiveStudioOrderFilters,
  normalizeStudioOrderStatus,
  studioOrderCountsTowardRevenue,
  studioOrderLineLabel,
  sumStudioPaidRevenue,
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

test('Studio filter tabs are Ordered plus the four live statuses', () => {
  expect([...STUDIO_ORDER_STATUSES]).toEqual([
    'Payment pending',
    'Confirmed',
    'Delivered',
    'Cancelled',
  ]);
  expect([...STUDIO_ORDER_FILTER_TABS]).toEqual([
    'Ordered',
    'Payment pending',
    'Confirmed',
    'Delivered',
    'Cancelled',
  ]);
  expect(normalizeStudioOrderStatus(undefined)).toBe('Payment pending');
  expect(normalizeStudioOrderStatus('')).toBe('Payment pending');
  expect(normalizeStudioOrderStatus('Confirmed')).toBe('Payment pending');
  expect(normalizeStudioOrderStatus('  Dispatched  ', { status: 'paid' })).toBe('Confirmed');
  expect(normalizeOrderStatus('Handloom Finishing', { status: 'paid' })).toBe('Confirmed');

  const counts = countStudioOrdersByStatus([
    ...catalogue,
    order({ id: 'VRN-1047', status: '' }),
  ]);
  expect(counts.Ordered).toBe(6);
  expect(counts['Payment pending']).toBe(3);
  expect(counts.Confirmed).toBe(1);
  expect(counts.Delivered).toBe(1);
  expect(counts.Cancelled).toBe(1);
});

test('status chips and search combine; payment is not a separate filter', () => {
  const defaults = createStudioOrderFilters();
  expect(defaults.status).toBe('Ordered');
  expect(defaults.payment).toBeUndefined();
  expect(filterStudioOrders(catalogue, defaults)).toHaveLength(5);

  expect(filterStudioOrders(catalogue, { ...defaults, status: 'Confirmed' }).map((o) => o.id))
    .toEqual(['VRN-1043']);
  expect(filterStudioOrders(catalogue, { ...defaults, status: 'Payment pending' }).map((o) => o.id))
    .toEqual(['VRN-1042', 'VRN-1044']);
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
    query: 'priya',
  }).map((o) => o.id)).toEqual(['VRN-1046']);
});

test('changing an order status immediately changes which status filter it matches', () => {
  const defaults = createStudioOrderFilters();
  const pending = filterStudioOrders(catalogue, { ...defaults, status: 'Payment pending' });
  expect(pending.map((o) => o.id)).toEqual(['VRN-1042', 'VRN-1044']);

  const afterUpdate = catalogue.map((item) => (
    item.id === 'VRN-1042' ? { ...item, status: 'Delivered' } : item
  ));
  expect(filterStudioOrders(afterUpdate, { ...defaults, status: 'Payment pending' }).map((o) => o.id))
    .toEqual(['VRN-1044']);
  expect(filterStudioOrders(afterUpdate, { ...defaults, status: 'Delivered' }).map((o) => o.id))
    .toEqual(['VRN-1042', 'VRN-1045']);
  expect(countStudioOrdersByStatus(afterUpdate).Delivered).toBe(2);
  expect(countStudioOrdersByStatus(afterUpdate)['Payment pending']).toBe(1);
});

test('Studio orders UI keeps the four statuses, lookup, and drops the payment filter', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/app/studio-desk/page.tsx', import.meta.url)), 'utf8');
  const css = readFileSync(fileURLToPath(new URL('../src/app/globals.css', import.meta.url)), 'utf8');
  expect(source).toContain('No orders match these filters');
  expect(source).toContain('filterStudioOrders');
  expect(source).toContain('STUDIO_ORDER_FILTER_TABS');
  expect(source).toContain('Order lookup');
  expect(source).toContain('StudioOrderLookup');
  expect(source).toContain('StudioOrderStatusEditor');
  expect(source).not.toContain('Confirm on WhatsApp');
  expect(source).not.toContain('STUDIO_PAYMENT_FILTERS');
  expect(source).not.toContain('countStudioOrdersByPayment');
  expect(source).not.toContain('studio-order-payment-filter');
  expect(source).not.toContain('Handloom Finishing');
  expect(source).not.toContain('Dispatched');
  expect(source).not.toContain('StudioPayment');
  expect(source).toContain('getProductCoverImage');
  expect(source).toContain('studioOrderLineLabel');
  expect(source).toContain('sumStudioPaidRevenue');
  expect(css).toContain('status-payment-pending');
  expect(css).toContain('status-cancelled');
  expect(css).not.toContain('status-handloom-finishing');
  expect(css).not.toContain('status-dispatched');
});

test('Studio revenue counts only paid non-cancelled orders', () => {
  const withTotals = [
    order({ id: 'VRN-unpaid', total: 1000, payment: null }),
    order({ id: 'VRN-razorpay', total: 2000, payment: { status: 'paid', provider: 'razorpay' } }),
    order({ id: 'VRN-offline', total: 3000, payment: { status: 'paid', provider: 'offline', method: 'UPI' } }),
    order({ id: 'VRN-processing', total: 4000, payment: { status: 'authorized' } }),
    order({ id: 'VRN-cancelled-paid', total: 5000, status: 'Cancelled', payment: { status: 'paid' } }),
    order({ id: 'VRN-cancelled-unpaid', total: 6000, status: 'Cancelled', payment: null }),
  ];
  expect(studioOrderCountsTowardRevenue(withTotals[0])).toBe(false);
  expect(studioOrderCountsTowardRevenue(withTotals[1])).toBe(true);
  expect(studioOrderCountsTowardRevenue(withTotals[2])).toBe(true);
  expect(studioOrderCountsTowardRevenue(withTotals[3])).toBe(false);
  expect(studioOrderCountsTowardRevenue(withTotals[4])).toBe(false);
  expect(sumStudioPaidRevenue(withTotals)).toBe(5000);
});

test('Studio order lines prefer the saved saree name, then catalogue, then product number', () => {
  expect(studioOrderLineLabel({ id: 4, name: 'Mayil emerald silk saree' }, { name: 'Other' })).toBe('Mayil emerald silk saree');
  expect(studioOrderLineLabel({ id: 4, qty: 1 }, { name: 'Gulabi rose Banarasi saree' })).toBe('Gulabi rose Banarasi saree');
  expect(studioOrderLineLabel({ id: 4, name: '  ' }, null)).toBe('Product #4');
  expect(studioOrderLineLabel({ id: 4 }, undefined)).toBe('Product #4');
});

test('active-filter helper ignores blank search text', () => {
  expect(hasActiveStudioOrderFilters(createStudioOrderFilters())).toBe(false);
  expect(hasActiveStudioOrderFilters({ ...createStudioOrderFilters(), query: '   ' })).toBe(false);
  expect(hasActiveStudioOrderFilters({ ...createStudioOrderFilters(), status: 'Delivered' })).toBe(true);
  expect(hasActiveStudioOrderFilters({ ...createStudioOrderFilters(), query: 'meera' })).toBe(true);
});
