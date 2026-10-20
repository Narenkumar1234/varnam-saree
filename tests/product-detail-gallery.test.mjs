import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

function applyGallerySelection(productId, selectedVariantIndex, galleryImages, prevDeps, selectedImage) {
  const galleryKey = galleryImages.join('|');
  const deps = [productId, selectedVariantIndex, galleryKey];
  const changed = !prevDeps || deps.some((value, index) => value !== prevDeps[index]);
  return {
    deps,
    selectedImage: changed ? galleryImages[0] : selectedImage,
  };
}

test('thumbnail clicks stick when galleryImages is a new array with the same contents', () => {
  let prevDeps = null;
  let selectedImage = '';
  ({ deps: prevDeps, selectedImage } = applyGallerySelection(1, 0, ['/a.webp', '/b.webp'], prevDeps, selectedImage));
  expect(selectedImage).toBe('/a.webp');

  selectedImage = '/b.webp';
  ({ deps: prevDeps, selectedImage } = applyGallerySelection(1, 0, ['/a.webp', '/b.webp'], prevDeps, selectedImage));
  expect(selectedImage).toBe('/b.webp');
});

test('changing variant selects that variant first image', () => {
  let prevDeps = null;
  let selectedImage = '';
  ({ deps: prevDeps, selectedImage } = applyGallerySelection(1, 0, ['/v1.webp', '/main.webp'], prevDeps, selectedImage));
  selectedImage = '/main.webp';
  ({ deps: prevDeps, selectedImage } = applyGallerySelection(1, 1, ['/v2.webp', '/main.webp'], prevDeps, selectedImage));
  expect(selectedImage).toBe('/v2.webp');
});

test('ProductDetail gallery effect depends on galleryKey, not the galleryImages array', () => {
  const src = readFileSync(new URL('../src/components/ProductDetail.tsx', import.meta.url), 'utf8');
  expect(src).toContain("const galleryKey = galleryImages.join('|')");
  expect(src).toContain('[product?.id, selectedVariantIndex, galleryKey]');
  expect(src).not.toMatch(/}, \[product\?\.id, product\?\.image, product\?\.images, selectedVariantIndex, galleryImages\]\)/);
});
