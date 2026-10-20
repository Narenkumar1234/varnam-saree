import { expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_COMMERCE } from '../src/lib/commerce.ts';
import { imageLoader, needsUnoptimized } from '../src/lib/image-loader.ts';
import { resolveColourHex } from '../src/lib/colour.ts';
import {
  buildProductGalleryImages,
  clampGalleryIndex,
  galleryImageAt,
  uniqueImageUrls,
} from '../src/lib/product-gallery.ts';

const WIKIMEDIA = 'https://upload.wikimedia.org/wikipedia/commons/red-saree.jpg';
const FIREBASE = 'https://firebasestorage.googleapis.com/v0/b/varnam-sarees.firebasestorage.app/o/products%2Fextra.webp?alt=media&token=abc-123';
const UNSPLASH = 'https://images.unsplash.com/photo-mountain';
const GOLD = '/assets/saree-ivory.webp';

const qaProduct = {
  image: WIKIMEDIA,
  images: [WIKIMEDIA, FIREBASE],
  variants: [
    { colour: 'Maroon', images: [UNSPLASH] },
    { colour: 'Gold', images: [GOLD] },
  ],
};

test('uniqueImageUrls drops blanks and keeps first occurrence', () => {
  expect(uniqueImageUrls([' /a.webp ', '', '/a.webp', null, '/b.webp', '  '])).toEqual(['/a.webp', '/b.webp']);
});

test('gallery is one deduped array: variant images first, then main images', () => {
  expect(buildProductGalleryImages(qaProduct, 0)).toEqual([UNSPLASH, WIKIMEDIA, FIREBASE]);
  expect(buildProductGalleryImages(qaProduct, 1)).toEqual([GOLD, WIKIMEDIA, FIREBASE]);
});

test('product.image is kept when additional photos omit it', () => {
  const product = {
    image: WIKIMEDIA,
    images: [FIREBASE],
    variants: [{ images: [UNSPLASH] }],
  };
  expect(buildProductGalleryImages(product, 0)).toEqual([UNSPLASH, WIKIMEDIA, FIREBASE]);
});

test('products without variants use the main image list only', () => {
  expect(buildProductGalleryImages({ image: WIKIMEDIA, images: [WIKIMEDIA, FIREBASE] }, 0))
    .toEqual([WIKIMEDIA, FIREBASE]);
  expect(buildProductGalleryImages({ image: WIKIMEDIA }, 0)).toEqual([WIKIMEDIA]);
  expect(buildProductGalleryImages(null, 0)).toEqual([]);
});

test('duplicate variant and main URLs appear once, in variant-first order', () => {
  const product = {
    image: UNSPLASH,
    images: [UNSPLASH, FIREBASE],
    variants: [{ images: [UNSPLASH, GOLD] }],
  };
  expect(buildProductGalleryImages(product, 0)).toEqual([UNSPLASH, GOLD, FIREBASE]);
});

test('thumbnail index N maps to gallery image N', () => {
  const gallery = buildProductGalleryImages(qaProduct, 0);
  expect(gallery.map((_, idx) => galleryImageAt(gallery, idx))).toEqual(gallery);
  expect(galleryImageAt(gallery, 0)).toBe(UNSPLASH);
  expect(galleryImageAt(gallery, 1)).toBe(WIKIMEDIA);
  expect(galleryImageAt(gallery, 2)).toBe(FIREBASE);
});

test('selected index resets to 0 when the variant changes', () => {
  let selectedVariantIndex = 0;
  let selectedImageIndex = 2;
  const onVariantChange = (nextVariant) => {
    selectedVariantIndex = nextVariant;
    selectedImageIndex = 0;
  };

  onVariantChange(1);
  const gallery = buildProductGalleryImages(qaProduct, selectedVariantIndex);
  const index = clampGalleryIndex(selectedImageIndex, gallery.length);
  expect(index).toBe(0);
  expect(galleryImageAt(gallery, index)).toBe(GOLD);
});

test('clampGalleryIndex keeps a clickable index inside the current gallery', () => {
  expect(clampGalleryIndex(0, 3)).toBe(0);
  expect(clampGalleryIndex(2, 3)).toBe(2);
  expect(clampGalleryIndex(-1, 3)).toBe(0);
  expect(clampGalleryIndex(9, 3)).toBe(2);
  expect(clampGalleryIndex(1, 0)).toBe(0);
});

test('image loader keeps Firebase %2F and token query inside the url param', () => {
  const href = imageLoader({ src: FIREBASE, width: 800, quality: 75 });
  const parsed = new URL(href, 'http://localhost');
  expect(parsed.pathname).toBe('/_next/image');
  expect(parsed.searchParams.get('url')).toBe(FIREBASE);
  expect(parsed.searchParams.get('w')).toBe('800');
  expect(parsed.searchParams.get('q')).toBe('75');
  expect(parsed.searchParams.get('token')).toBe(null);
  expect(parsed.searchParams.get('alt')).toBe(null);
  expect(href).toContain(encodeURIComponent(FIREBASE));
  expect(needsUnoptimized(FIREBASE)).toBe(false);
  expect(needsUnoptimized(WIKIMEDIA)).toBe(false);
  expect(needsUnoptimized(UNSPLASH)).toBe(false);
  expect(needsUnoptimized(GOLD)).toBe(false);
  expect(imageLoader({ src: WIKIMEDIA, width: 400 }).includes(encodeURIComponent(WIKIMEDIA))).toBe(true);
  expect(imageLoader({ src: UNSPLASH, width: 400 }).includes(encodeURIComponent(UNSPLASH))).toBe(true);
});

test('ProductDetail thumbs and main image share the gallery builder and selected index', () => {
  const src = readFileSync(new URL('../src/components/ProductDetail.tsx', import.meta.url), 'utf8');
  expect(src).toContain('buildProductGalleryImages(product, selectedVariantIndex)');
  expect(src).toContain('const [selectedImageIndex, setSelectedImageIndex] = useState(0)');
  expect(src).toContain('setSelectedImageIndex(0)');
  expect(src).toContain('onClick={() => setSelectedImageIndex(idx)}');
  expect(src).toContain('const isCurrent = idx === currentImageIndex');
  expect(src).toContain('key={currentImage}');
  expect(src).toContain('src={currentImage}');
  expect(src).toContain('loader={imageLoader}');
  expect(src).toContain('PINCODE_PATTERN_MESSAGE');
  expect(src).not.toContain('galleryKey');
  expect(src).not.toContain('setSelectedImage(');
});

const qaStoreProduct = {
  id: 10,
  name: 'QA gallery saree',
  type: 'Banarasi silk',
  collection: 'Silk',
  price: 8000,
  colour: 'Rose',
  tag: '',
  image: WIKIMEDIA,
  images: [WIKIMEDIA, FIREBASE],
  variants: [
    { name: 'Maroon', colour: 'Maroon', images: [UNSPLASH] },
    { name: 'Gold', colour: 'Gold', images: [GOLD] },
  ],
};

mock.module('../src/context/store-context.tsx', () => ({
  useStore: () => ({
    products: [qaStoreProduct],
    getProductById: () => qaStoreProduct,
    addToCart: () => {},
    wish: [],
    toggleWish: () => {},
    orderProductOnWhatsApp: () => {},
    couponCode: '',
    commerce: DEFAULT_COMMERCE,
  }),
}));
mock.module('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => '/product/10',
  useSearchParams: () => new URLSearchParams(),
}));
mock.module('next/image', () => ({
  default: ({ alt, src }) => createElement('img', { alt, src }),
}));
mock.module('next/link', () => ({
  default: ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
}));

const { default: ProductDetail } = await import('../src/components/ProductDetail.tsx');

test('rendered gallery uses one array: main image is index 0 and thumbs stay in the same order', () => {
  const gallery = buildProductGalleryImages(qaStoreProduct, 0);
  const markup = renderToStaticMarkup(createElement(ProductDetail, { id: '10' }));
  const srcs = [...markup.matchAll(/src="([^"]+)"/g)].map((match) => match[1].replaceAll('&amp;', '&'));
  expect(gallery).toEqual([UNSPLASH, WIKIMEDIA, FIREBASE]);
  expect(srcs[0]).toBe(gallery[0]);
  expect(srcs.slice(1, 4)).toEqual(gallery);
  expect(markup).toContain('aria-selected="true"');
  expect(markup).toContain('View photo 1 of QA gallery saree');
  expect(markup).toContain('View photo 3 of QA gallery saree');
  expect(markup).toContain('Includes unstitched blouse piece');
  expect(markup).not.toContain('Choose finishing');
  expect(resolveColourHex('Maroon')).not.toBe(resolveColourHex('Gold'));
  expect(markup).toContain(resolveColourHex('Maroon'));
  expect(markup).toContain(resolveColourHex('Gold'));
  expect(markup).toContain('title="Maroon"');
  expect(markup).toContain('title="Gold"');
});

test('desktop gallery places a vertical thumbnail rail to the right of the main image', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  const src = readFileSync(new URL('../src/components/ProductDetail.tsx', import.meta.url), 'utf8');
  expect(src).toContain('product-gallery-stage');
  expect(src).toContain('gallery-thumbnails');
  expect(src).toContain('product-gallery-main');
  expect(css).toContain('aspect-ratio: 4 / 5');
  expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*\.product-gallery-stage:has\(\.gallery-thumbnails\)[\s\S]*grid-template-columns: minmax\(0, 1fr\) 72px/);
  expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*flex-direction: column/);
  expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*overflow-y: auto/);
});

test('mobile gallery keeps a compact horizontal thumbnail row that cannot overflow', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  expect(css).toContain('flex-direction: row');
  expect(css).toContain('overflow-x: auto');
  expect(css).toContain('max-width: 100%');
});
