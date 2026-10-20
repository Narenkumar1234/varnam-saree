import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isPaidPayment } from '../src/lib/order-status.ts';

const source = readFileSync(fileURLToPath(new URL('../src/app/confirmation/[id]/page.tsx', import.meta.url)), 'utf8');

test('confirmation page keeps confirmed wording only after payment is captured', () => {
  expect(isPaidPayment(undefined)).toBe(false);
  expect(isPaidPayment({ status: 'pending' })).toBe(false);
  expect(isPaidPayment({ status: 'authorized' })).toBe(false);
  expect(isPaidPayment({ status: 'paid' })).toBe(true);

  expect(source).toContain('isPaidPayment(order.payment)');
  expect(source).toContain('Order placed — awaiting payment');
  expect(source).toContain('Your order <strong>{order.id}</strong> is confirmed.');
  expect(source).toContain("idleLabel={order.payment ? 'Retry payment' : 'Pay now'}");
  expect(source).toContain('CustomerPayment');
});
