import { beforeEach, expect, mock, test } from 'bun:test';
import { createContext, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_SETTINGS } from '../src/lib/commerce.ts';

let store;
mock.module('../src/context/store-context.tsx', () => ({
  StoreContext: createContext(undefined), useStore: () => store }));
mock.module('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { const err = new Error('NEXT_HTTP_ERROR_FALLBACK;404'); err.digest = 'NEXT_HTTP_ERROR_FALLBACK;404'; throw err; },
}));
mock.module('next/image', () => ({
  default: ({ alt, src, width, height }) => createElement('img', { alt, src, width, height }),
}));
mock.module('next/link', () => ({
  default: ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
}));

const { Header } = await import('../src/components/Header.tsx');

beforeEach(() => {
  store = {
    totalBagCount: 0,
    commerce: {
      settings: { ...DEFAULT_SETTINGS },
      coupons: [{ code: 'OFFER50', percentage: 50, enabled: true, minSubtotal: 0, expiresOn: null }],
    },
    products: [
      { id: 1, name: 'Rose Banarasi', type: 'Silk', collection: 'Silk', price: 8000, oldPrice: 10000, colour: 'Rose', image: '/assets/saree-rose.webp' },
    ],
  };
});

test('Header Offers uses max product discount when a larger coupon exists', () => {
  const markup = renderToStaticMarkup(createElement(Header));
  expect(markup).toContain('href="/shop?offers=20"');
  expect(markup).toContain('up to 20% OFF');
  expect(markup).toContain('Offers: up to 20% off');
  expect(markup).not.toContain('href="/shop?offers=50"');
  expect(markup).not.toContain('50% OFF');
});

test('Header Offers is hidden when there are no product discounts and no coupon', () => {
  store.commerce.coupons = [];
  store.products = [{ id: 1, name: 'Full price', type: 'Silk', collection: 'Silk', price: 5000, colour: 'Rose', image: '/assets/saree-rose.webp' }];
  const markup = renderToStaticMarkup(createElement(Header));
  expect(markup).not.toContain('offers-nav-link');
});

test('Header Offers links to /shop and shows the coupon when only a coupon exists', () => {
  store.products = [{ id: 1, name: 'Full price', type: 'Silk', collection: 'Silk', price: 5000, colour: 'Rose', image: '/assets/saree-rose.webp' }];
  const markup = renderToStaticMarkup(createElement(Header));
  expect(markup).toContain('class="offers-nav-link"');
  expect(markup).toContain('href="/shop"');
  expect(markup).toContain('OFFER50 50% OFF');
  expect(markup).not.toContain('href="/shop?offers=50"');
});
