import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { createContext, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_SETTINGS, getMarqueeMessages, settingsFromRows } from '../src/lib/commerce.ts';

let store;
mock.module('../src/context/store-context.tsx', () => ({ StoreContext: createContext(undefined), useStore: () => store }));
const pages = {
  terms: (await import('../src/app/terms/page.tsx')).default,
  privacy: (await import('../src/app/privacy/page.tsx')).default,
  refund: (await import('../src/app/refund/page.tsx')).default,
  shipping: (await import('../src/app/shipping/page.tsx')).default,
};
const { Footer } = await import('../src/components/Footer.tsx');
const text = (component) => renderToStaticMarkup(createElement(component)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const WRONG_TIMELINE = /2\s*(to|-|–)\s*5\s*(business\s*)?days/i;

beforeEach(() => { store = { commerce: { settings: { ...DEFAULT_SETTINGS } }, clearDemo: () => {} }; });
afterAll(() => mock.restore());

for (const [name, Page] of Object.entries(pages)) {
  test(`${name} policy page shows the Varnam identity and the correct delivery timeline`, () => {
    const copy = text(Page);
    expect(copy).toContain('Varnam');
    expect(copy).toContain('Gomathipuram');
    expect(copy).toContain('Madurai, Tamil Nadu 625020');
    expect(copy).toContain('+91 93604 51710');
    expect(copy).toContain('varnamsarees52@gmail.com');
    expect(copy).not.toMatch(WRONG_TIMELINE);
    expect(copy).not.toMatch(/\bTBD\b|demo|illustrative/i);
  });
}

test('terms and privacy name the grievance officer; refund policy requires an unboxing video', () => {
  expect(text(pages.terms)).toContain('grievance officer for Varnam is Kavitha');
  expect(text(pages.privacy)).toContain('grievance officer, Kavitha');
  expect(text(pages.refund)).toContain('unboxing video');
  expect(text(pages.shipping)).toContain('dispatched within 2 business days');
});

test('footer links every policy page and shows the address', () => {
  const markup = renderToStaticMarkup(createElement(Footer));
  for (const href of ['/terms', '/privacy', '/refund', '/shipping', '/contact']) expect(markup).toContain(`href="${href}"`);
  expect(markup).toContain('Gomathipuram');
});

test('the legacy stored "2 to 5 days" banner is replaced by the confirmed timeline', () => {
  const settings = settingsFromRows([{ key: 'marqueeMessage1', value: 'Dispatch time 2 to 5 business days' }]);
  expect(getMarqueeMessages(settings).join(' ')).not.toMatch(WRONG_TIMELINE);
  expect(settings.marqueeMessage1).toBe('Dispatch within 2 business days · Delivery in 5–7 business days');
  expect(settingsFromRows([{ key: 'marqueeMessage1', value: 'Owner update' }]).marqueeMessage1).toBe('Owner update');
});

test('FAQ ordering answer lists only UPI and debit cards, once', async () => {
  const { faqs } = await import('../src/data/products.ts');
  const entry = faqs.find(([q]) => q === 'How do I order?');
  expect(entry).toBeTruthy();
  expect(entry[1]).toContain('UPI or a debit card');
  expect(entry[1]).not.toMatch(/net ?banking|credit|wallet|cards,/i);
  expect(entry[1].match(/send a request on WhatsApp/g)).toHaveLength(1);
  expect(faqs.some(([q]) => q === 'Can I place a real order?')).toBe(false);
});

test('studio desk metadata is noindex with its own title and no home canonical', async () => {
  const { metadata } = await import('../src/app/studio-desk/layout.tsx');
  expect(metadata.title).toEqual({ absolute: 'Studio | Varnam' });
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
  expect(metadata.alternates.canonical).toBeNull();
});

test('replacement window, shipping charges, no COD and shop timings are stated consistently', async () => {
  const refund = text(pages.refund), terms = text(pages.terms), shipping = text(pages.shipping);
  expect(refund).toContain('within 5 days of delivery');
  expect(terms).toContain('within 5 days of delivery');
  expect(shipping).toContain('Shipping charges vary by delivery location and order, and are shown at checkout before you pay.');
  expect(shipping).toContain('free delivery on orders above ₹2,999; otherwise, a ₹150 delivery charge applies');
  for (const copy of [shipping, terms]) expect(copy).toContain('Cash on delivery is not available; all orders are prepaid online via UPI or debit card');
  for (const copy of Object.values(pages).map(text)) expect(copy).toContain('Shop timings: 10:00 AM to 8:30 PM');
  const { faqs } = await import('../src/data/products.ts');
  const all = faqs.map(([q, a]) => `${q} ${a}`).join(' ');
  expect(all).toContain('Cash on delivery is not available');
  expect(all).toContain('within 5 days of delivery');
});
