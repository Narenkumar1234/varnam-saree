import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { formatIstDate, formatIstDateTime } from '../src/lib/datetime.ts';
import { formatOrderCreatedAtIst } from '../src/lib/order-status.ts';
import { checkoutWhatsAppMessage } from '../src/lib/whatsapp.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('order times are shown in IST regardless of the process time zone', () => {
  // 4:52 PM IST = 11:22 UTC
  expect(formatIstDateTime('2026-10-21T11:22:00.000Z')).toBe('21 Oct 2026, 4:52 pm');
  expect(formatOrderCreatedAtIst('2026-10-21T11:22:00.000Z')).toBe('21 Oct 2026, 4:52 pm');
  // Just after midnight IST is still the previous day in UTC
  expect(formatIstDate('2026-10-21T18:45:00Z')).toBe('22 Oct 2026');
  expect(formatIstDateTime('2026-10-21T18:45:00Z')).toBe('22 Oct 2026, 12:15 am');
  expect(formatIstDateTime('2026-01-05T06:30:00Z')).toBe('5 Jan 2026, 12:00 pm');
  expect(formatIstDateTime(new Date('2026-09-01T00:00:00Z'))).toBe('1 Sep 2026, 5:30 am');
  expect(formatIstDateTime('not a date')).toBe('');
  expect(formatIstDate(null)).toBe('');
  expect(formatOrderCreatedAtIst('  ')).toBe('');
});

test('admin and customer order dates go through the IST formatter', () => {
  expect(read('src/app/studio-desk/page.tsx')).toContain('formatIstDateTime(o.createdAt)');
  expect(read('src/components/AccountView.tsx')).toContain('formatIstDate(order.createdAt) || order.date');
  expect(read('src/components/TrackedOrderView.tsx')).toContain('formatIstDate(order.createdAt)');
  expect(read('src/context/store-context.tsx')).toContain('formatIstDate(createdAt)');
  for (const path of ['src/app/studio-desk/page.tsx', 'src/components/AccountView.tsx', 'src/components/TrackedOrderView.tsx', 'src/context/store-context.tsx', 'src/lib/order-status.ts']) {
    expect(read(path)).not.toMatch(/toLocale(Date|Time)?String\('en-IN', \{\s*(day|timeZone)/);
  }
});

test('checkout WhatsApp message carries the real order ID and totals', () => {
  const msg = checkoutWhatsAppMessage('VRN-abc', {
    items: [{ id: 4, qty: 2, name: 'Ananya green festive saree', unitPrice: 4590, total: 9180 }],
    pricing: { subtotal: 9180, discountAmount: 0, shipping: 0, total: 9180, couponCode: null },
  }, { first: 'Asha', last: 'R', phone: '9876543210', address: '1 Main St', city: 'Chennai', state: 'Tamil Nadu', pin: '600001' }, 'https://varnam-saree.vercel.app');
  expect(msg).toContain('Order: VRN-abc');
  expect(msg).toContain('Status: Payment pending');
  expect(msg).toContain('Ananya green festive saree × 2');
  expect(msg).toContain('Order total: ₹9,180');
  expect(msg).toContain('Customer: Asha R');
  expect(msg).toContain('Delivery address: 1 Main St, Chennai, Tamil Nadu, 600001');
  expect(msg).toContain('/track?order=VRN-abc');
});

test('Order on WhatsApp saves the order through the same submit, then opens WhatsApp', () => {
  const src = read('src/app/checkout/page.tsx');
  // one submit path: the WhatsApp button is a submit button for the same form
  expect(src).toContain('data-payment="whatsapp"');
  expect(src).not.toContain('handleWhatsAppCheckout');
  expect(src).not.toContain('openWhatsAppMessage');
  // double-click guard and tab opened inside the click
  expect(src).toContain('if (submittingRef.current || checkoutError) return;');
  expect(src.indexOf('openPendingWhatsAppWindow()')).toBeLessThan(src.indexOf('await placeOrder('));
  expect(src).toContain('whatsAppWindow.location.replace(whatsAppUrl)');
  expect(src).toContain('?via=whatsapp&open=1');
  const confirmation = read('src/app/confirmation/[id]/page.tsx');
  expect(confirmation).toContain("window.history.replaceState(null, '', `/confirmation/");
  expect(confirmation).toContain('window.location.assign(orderWhatsAppUrl)');
});
