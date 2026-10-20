import { expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { DEFAULT_COMMERCE } from '../src/lib/commerce.ts';
import { getCartLineImage } from '../src/lib/product-gallery.ts';
import { needsUnoptimized } from '../src/lib/image-loader.ts';

const FIREBASE = 'https://firebasestorage.googleapis.com/v0/b/varnam-sarees.firebasestorage.app/o/products%2Fmaroon.webp?alt=media&token=abc-123';
const FIREBASE_APP = 'https://varnam-sarees.firebasestorage.app/o/products%2Fmaroon.webp';
const COVER = '/assets/saree-rose.webp';

const qaProduct = {
  id: 10,
  name: 'QA gallery saree',
  type: 'Banarasi silk',
  collection: 'Silk',
  price: 8000,
  colour: 'Rose',
  tag: '',
  image: COVER,
  images: [COVER],
  variants: [
    { name: 'Maroon', colour: 'Maroon', images: [FIREBASE] },
    { name: 'Gold', colour: 'Gold', images: [] },
  ],
};

test('cart line image for product 10 Maroon uses the variant Firebase URL, not the stale cover', () => {
  expect(getCartLineImage(qaProduct, 0)).toBe(FIREBASE);
  expect(getCartLineImage(qaProduct, 1)).toBe(COVER);
});

test('Firebase Storage hosts stay on the optimized loader', () => {
  expect(needsUnoptimized(FIREBASE)).toBe(false);
  expect(needsUnoptimized(FIREBASE_APP)).toBe(false);
  expect(needsUnoptimized(COVER)).toBe(false);
});

test('ProductThumb and cart page wire onError to a neutral fallback tile', () => {
  const thumb = readFileSync(new URL('../src/components/ProductThumb.tsx', import.meta.url), 'utf8');
  const cart = readFileSync(new URL('../src/app/cart/page.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  expect(thumb).toContain('onError={() => setFailed(true)}');
  expect(thumb).toContain('product-thumb-fallback');
  expect(thumb).toContain('loader={imageLoader}');
  expect(thumb).toContain('aria-hidden="true"');
  expect(cart).toContain('<ProductThumb');
  expect(cart).toContain('getCartLineImage');
  expect(css).toContain('.product-thumb-fallback');
  expect(css).toContain('background: #efeae3');
});

mock.module('../src/context/store-context.tsx', () => ({
  useStore: () => ({
    cart: [{ id: 10, qty: 2 }],
    products: [qaProduct],
    getProductById: () => qaProduct,
    cartError: null,
    couponCode: null,
    applyCoupon: () => ({ valid: false, error: '' }),
    removeCoupon: () => {},
    cartQuote: {
      items: [{ id: 10, qty: 2, name: qaProduct.name, unitPrice: 8000, subtotal: 16000, discountAmount: 0, total: 16000 }],
      pricing: { subtotal: 16000, discountAmount: 0, shipping: 0, total: 16000 },
    },
    adjustCardQuantity: () => {},
    removeItem: () => {},
    orderCartOnWhatsApp: () => {},
    commerce: DEFAULT_COMMERCE,
  }),
}));
mock.module('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => '/cart',
  useSearchParams: () => new URLSearchParams(),
}));
mock.module('next/image', () => ({
  default: ({ alt, src }) => createElement('img', { alt, src }),
}));
mock.module('next/link', () => ({
  default: ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
}));

const { default: CartPage } = await import('../src/app/cart/page.tsx');

test('cart page renders the Maroon variant image through ProductThumb', () => {
  const markup = renderToStaticMarkup(createElement(CartPage));
  expect(markup).toContain(FIREBASE.replaceAll('&', '&amp;'));
  expect(markup).toContain('QA gallery saree');
  expect(markup).toContain('quantity-stepper');
  expect(markup).toContain('Decrease quantity');
  expect(markup).toContain('Increase quantity');
  expect(markup).toContain('>2<');
});
