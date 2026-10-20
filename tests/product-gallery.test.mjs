import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  buildProductGalleryImages,
  clampGalleryIndex,
  getProductCoverImage,
  normalizeProductImages,
} from '../src/lib/product-gallery.ts';

const product = {
  id: 1,
  name: 'Test silk',
  image: '/main.webp',
  images: ['/first.webp', '/second.webp', '/third.webp'],
};

test('normalizeProductImages keeps Studio array order and skips unusable URLs', () => {
  expect(normalizeProductImages(['/a.webp', 'blob:http://localhost/x', '  /b.webp  ', 'data:image/png;base64,abc'])).toEqual(['/a.webp', '/b.webp']);
  expect(normalizeProductImages('["/a.webp","/b.webp"]')).toEqual(['/a.webp', '/b.webp']);
  expect(normalizeProductImages('/a.webp, /b.webp')).toEqual(['/a.webp', '/b.webp']);
  expect(normalizeProductImages(null)).toEqual([]);
});

test('normalizeProductImages sorts object entries by lowest sort order', () => {
  expect(normalizeProductImages([
    { url: '/c.webp', sortOrder: 20 },
    { src: '/a.webp', sort: 1 },
    { imageUrl: '/b.webp', order: 2 },
  ])).toEqual(['/a.webp', '/b.webp', '/c.webp']);
});

test('getProductCoverImage uses the first Studio photo, then main image, then placeholder', () => {
  expect(getProductCoverImage(product)).toBe('/first.webp');
  expect(getProductCoverImage({ image: '/main.webp', images: [] })).toBe('/main.webp');
  expect(getProductCoverImage({ imageUrl: '/legacy.webp' })).toBe('/legacy.webp');
  expect(getProductCoverImage({})).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  expect(getProductCoverImage(null)).toBe(PRODUCT_IMAGE_PLACEHOLDER);
});

test('cover image ignores colour-variant photos (no variant selected)', () => {
  const withVariants = {
    ...product,
    image: '/stale-main.webp',
    variants: [{ name: 'Rose', colour: 'Rose', images: ['/variant-first.webp', '/variant-second.webp'] }],
  };
  expect(getProductCoverImage(withVariants)).toBe('/first.webp');
});

test('buildProductGalleryImages prepends a selected variant, then the main image list', () => {
  expect(buildProductGalleryImages(product)).toEqual(['/main.webp', '/first.webp', '/second.webp', '/third.webp']);
  expect(buildProductGalleryImages({ image: '/only.webp' })).toEqual(['/only.webp']);

  const withVariants = {
    ...product,
    variants: [
      { name: 'Rose', images: ['/v1.webp', '/second.webp'] },
      { name: 'Ivory', images: ['/v2.webp'] },
    ],
  };
  expect(buildProductGalleryImages(withVariants, 0)).toEqual(['/v1.webp', '/second.webp', '/main.webp', '/first.webp', '/third.webp']);
  expect(buildProductGalleryImages(withVariants, 1)).toEqual(['/v2.webp', '/main.webp', '/first.webp', '/second.webp', '/third.webp']);
});

test('clampGalleryIndex keeps a clickable index inside the current gallery', () => {
  expect(clampGalleryIndex(2, 3)).toBe(2);
  expect(clampGalleryIndex(9, 2)).toBe(1);
  expect(clampGalleryIndex(-1, 1)).toBe(0);
  expect(clampGalleryIndex(1.5, 2)).toBe(0);
  expect(clampGalleryIndex(0, 0)).toBe(0);
});

test('listing cards, cart, related products and Studio thumbs share getProductCoverImage', () => {
  const card = readFileSync(new URL('../src/components/ProductCard.tsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/components/ProductDetail.tsx', import.meta.url), 'utf8');
  const cart = readFileSync(new URL('../src/app/cart/page.tsx', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../src/app/studio-desk/page.tsx', import.meta.url), 'utf8');
  expect(card).toContain('getProductCoverImage');
  expect(card).not.toMatch(/src=\{product\.image\}/);
  expect(detail).toContain('<ProductCard');
  expect(cart).toContain('getProductCoverImage');
  expect(studio).toContain('getProductCoverImage');
});
