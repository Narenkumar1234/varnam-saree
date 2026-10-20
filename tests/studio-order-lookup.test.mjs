import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudioOrderLookup } from '../src/components/StudioOrderLookup.tsx';
import { StudioOrderStatusEditor } from '../src/components/StudioOrderStatusEditor.tsx';

const desk = readFileSync(fileURLToPath(new URL('../src/app/studio-desk/page.tsx', import.meta.url)), 'utf8');
const lookup = readFileSync(fileURLToPath(new URL('../src/components/StudioOrderLookup.tsx', import.meta.url)), 'utf8');
const editor = readFileSync(fileURLToPath(new URL('../src/components/StudioOrderStatusEditor.tsx', import.meta.url)), 'utf8');
const route = readFileSync(fileURLToPath(new URL('../src/app/api/admin/orders/[id]/route.ts', import.meta.url)), 'utf8');
const schema = readFileSync(fileURLToPath(new URL('../src/db/schema.ts', import.meta.url)), 'utf8');
const createOrder = readFileSync(fileURLToPath(new URL('../src/app/api/orders/route.ts', import.meta.url)), 'utf8');

function optionMarkup(html, value) {
  return html.match(new RegExp(`<option[^>]*value="${value}"[^>]*>`))?.[0] || '';
}

test('Studio nav links to Order lookup and deep-links ?order=', () => {
  expect(desk).toContain("setActiveTab('lookup')");
  expect(desk).toContain('Order lookup');
  expect(desk).toContain("get('order')");
  expect(lookup).toContain('No order found');
  expect(lookup).toContain('formatOrderCreatedAtIst');
  expect(lookup).toContain('India Standard Time');
  expect(lookup).toContain("searchParams.set('order'");
  expect(lookup).toContain('normalizeStudioOrderLookupId');
  expect(lookup).toContain('studioAdminPaymentDetails');
  expect(lookup).toContain('Razorpay payment ID');
  expect(route).toContain('lookupOrderById');
  expect(route).not.toContain('if (id.toLowerCase() === id) return null;');
  expect(editor).toContain('confirm(`Change order');
  expect(editor).toContain('adminStatusChangeError');
  expect(schema).toContain("default('Payment pending')");
  expect(schema).not.toContain('Handloom Finishing');
  expect(createOrder).toContain("status: 'Payment pending'");
  expect(createOrder).not.toContain("status: 'Confirmed'");
});

test('lookup form and status editor render the four statuses', () => {
  const html = renderToStaticMarkup(createElement(StudioOrderLookup, {
    products: [],
    adminFetch: async () => new Response('{}'),
    onUpdated() {},
    showToast() {},
  }));
  expect(html).toContain('Order lookup');
  expect(html).toContain('Order ID');
  expect(html).toContain('VRN-');

  const editorHtml = renderToStaticMarkup(createElement(StudioOrderStatusEditor, {
    orderId: 'VRN-1',
    status: 'Confirmed',
    adminFetch: async () => new Response('{}'),
    onUpdated() {},
  }));
  expect(editorHtml).toContain('Payment pending');
  expect(editorHtml).toContain('Confirmed');
  expect(editorHtml).toContain('Delivered');
  expect(editorHtml).toContain('Cancelled');
  expect(editorHtml).toContain('Mark as paid (offline)');
  expect(optionMarkup(editorHtml, 'Payment pending')).not.toContain('disabled');
  expect(optionMarkup(editorHtml, 'Confirmed')).toContain('disabled');
  expect(optionMarkup(editorHtml, 'Delivered')).toContain('disabled');
  expect(optionMarkup(editorHtml, 'Cancelled')).not.toContain('disabled');

  const paidHtml = renderToStaticMarkup(createElement(StudioOrderStatusEditor, {
    orderId: 'VRN-1',
    status: 'Confirmed',
    payment: { provider: 'razorpay', status: 'paid' },
    adminFetch: async () => new Response('{}'),
    onUpdated() {},
  }));
  expect(optionMarkup(paidHtml, 'Confirmed')).not.toContain('disabled');
  expect(optionMarkup(paidHtml, 'Delivered')).not.toContain('disabled');
  expect(optionMarkup(paidHtml, 'Payment pending')).toContain('disabled');
});
