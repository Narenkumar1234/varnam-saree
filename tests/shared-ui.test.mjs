import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { createContext, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_SETTINGS } from '../src/lib/commerce.ts';
import { VARNAM_CONFIG } from '../src/data/products.ts';
import { getWhatsAppNumber, createWhatsAppOrderUrl } from '@/lib/whatsapp';

let store;
const originalNumber = VARNAM_CONFIG.whatsappNumber;
mock.module('../src/context/store-context.tsx', () => ({
  StoreContext: createContext(undefined), useStore: () => store }));
const { DeliveryPolicy } = await import('../src/components/DeliveryPolicy.tsx');
const { WhatsAppFallback } = await import('../src/components/WhatsAppFallback.tsx');
const { default: ShippingPage } = await import('../src/app/shipping/page.tsx');
const render = (component, props) => renderToStaticMarkup(createElement(component, props));
const plainText = (markup) => markup.replace(/<[^>]*>/g, '');

beforeEach(() => {
  store = { commerce: { settings: { ...DEFAULT_SETTINGS } }, whatsAppFallback: null, clearWhatsAppFallback: () => {} };
  VARNAM_CONFIG.whatsappNumber = originalNumber;
});
afterAll(() => { VARNAM_CONFIG.whatsappNumber = originalNumber; mock.restore(); });

test('DeliveryPolicy renders standalone and embedded variants through its real component props', () => {
  expect(plainText(render(DeliveryPolicy))).toBe('Free delivery on orders above ₹2,999.');
  expect(plainText(render(DeliveryPolicy, { includeFee: true }))).toBe('Free delivery on orders above ₹2,999; otherwise, a ₹150 delivery charge applies.');
  expect(plainText(render(DeliveryPolicy, { includeFee: true, embedded: true }))).toBe('free delivery on orders above ₹2,999; otherwise, a ₹150 delivery charge applies');
});

test('the actual shipping page embeds the policy with correct case and exactly one full stop', () => {
  const copy = plainText(render(ShippingPage));
  expect(copy).toContain('We offer free delivery on orders above ₹2,999; otherwise, a ₹150 delivery charge applies.');
  expect(copy).not.toContain('We offer Free'); expect(copy).not.toContain('applies..');
  store.commerce.settings = { ...DEFAULT_SETTINGS, freeDeliveryThreshold: 4999, standardShippingFee: 225 };
  expect(plainText(render(ShippingPage))).toContain('We offer free delivery on orders above ₹4,999; otherwise, a ₹225 delivery charge applies.');
});

test('the embedded component handles free delivery on every order without a stray fee or punctuation', () => {
  store.commerce.settings.standardShippingFee = 0;
  expect(plainText(render(DeliveryPolicy, { includeFee: true, embedded: true }))).toBe('free delivery on all orders');
  expect(plainText(render(ShippingPage))).toContain('We offer free delivery on all orders.');
});

test('the WhatsApp alias exports the same normalized contact used by the actual fallback component and order URL', () => {
  // Reserved fictional subscriber number; no request or navigation is performed.
  VARNAM_CONFIG.whatsappNumber = '+1 (202) 555-0100';
  expect(getWhatsAppNumber()).toBe('12025550100');
  const url = createWhatsAppOrderUrl('Saree & details');
  expect(new URL(url).pathname).toBe('/12025550100');
  expect(new URL(url).searchParams.get('text')).toBe('Saree & details');
  store.whatsAppFallback = { url };
  const markup = render(WhatsAppFallback);
  expect(plainText(markup)).toContain('Business number: +12025550100');
  expect(markup).toContain('href="'+url+'"');
});

test('WhatsApp fallback remains hidden until needed and handles an unconfigured number', () => {
  expect(render(WhatsAppFallback)).toBe('');
  VARNAM_CONFIG.whatsappNumber = '';
  expect(getWhatsAppNumber()).toBe(''); expect(createWhatsAppOrderUrl('Saree')).toBeNull();
  store.whatsAppFallback = { url: null };
  const markup = render(WhatsAppFallback);
  expect(plainText(markup)).toContain('WhatsApp ordering is unavailable. Please contact the store.');
  expect(markup).not.toContain('href=');
});
