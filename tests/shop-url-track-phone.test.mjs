import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseShopFiltersFromParams, shopFiltersToParams, shopFiltersKey } from '../src/lib/shop-filters.ts';
import { trackingDeliveryCopy } from '../src/lib/order-status.ts';

const options = { collections: ['All', 'Silk', 'Cotton'], colours: ['Emerald', 'Off-White', 'Rose'], priceBounds: { min: 2000, max: 9000 } };

test('shop filters are read from URL params using primary-colour options', () => {
  const f = parseShopFiltersFromParams(new URLSearchParams('colour=emerald,ROSE&collection=silk&min=3000&max=99999&offers=25'), options);
  expect(f).toEqual({ collection: 'Silk', colours: ['Emerald', 'Rose'], priceRange: { min: 3000, max: 9000 }, minDiscount: 25 });
  const repeated = parseShopFiltersFromParams(new URLSearchParams('colour=Rose&colour=rose&color=off-white'), options);
  expect(repeated.colours).toEqual(['Rose', 'Off-White']);
  const empty = parseShopFiltersFromParams(new URLSearchParams(''), options);
  expect(empty).toEqual({ collection: 'All', colours: [], priceRange: { min: 2000, max: 9000 }, minDiscount: 0 });
  expect(parseShopFiltersFromParams(new URLSearchParams('collection=Nope&discount=10'), options)).toMatchObject({ collection: 'All', minDiscount: 10 });
});

test('shop filters are written to the URL, keeping other params and omitting defaults', () => {
  const f = { collection: 'Silk', colours: ['Emerald', 'Rose'], priceRange: { min: 3000, max: 9000 }, minDiscount: 25 };
  const params = shopFiltersToParams(f, options.priceBounds, 'q=silk&discount=10');
  expect(params.toString()).toBe('q=silk&collection=Silk&colour=Emerald%2CRose&min=3000&offers=25');
  const round = parseShopFiltersFromParams(params, options);
  expect(shopFiltersKey(round)).toBe(shopFiltersKey(f));
  const none = shopFiltersToParams({ collection: 'All', colours: [], priceRange: { min: 2000, max: 9000 }, minDiscount: 0 }, options.priceBounds, 'colour=Rose');
  expect(none.toString()).toBe('');
});

test('SareeListing syncs filters with the URL without a router round trip', () => {
  const src = readFileSync(new URL('../src/components/SareeListing.tsx', import.meta.url), 'utf8');
  expect(src).toContain('parseShopFiltersFromParams(searchParams, filterOptions)');
  expect(src).toContain('shopFiltersToParams(filters, priceBounds, current)');
  expect(src).toContain('window.history.replaceState');
});

test('track page delivery copy reflects the stored delivery charge', () => {
  expect(trackingDeliveryCopy({ shipping: 0 })).toBe('Complimentary insured shipping across India.');
  expect(trackingDeliveryCopy({ shipping: 150 })).toContain('₹150');
  expect(trackingDeliveryCopy({ shipping: 150 })).not.toContain('Complimentary');
  expect(trackingDeliveryCopy(undefined)).toBe('Insured shipping across India.');
  const view = readFileSync(new URL('../src/components/TrackedOrderView.tsx', import.meta.url), 'utf8');
  expect(view).toContain('trackingDeliveryCopy(order.pricing)');
  expect(view).not.toContain('Complimentary insured shipping across India.');
});

test('phone: floating socials only show over the footer; card tags wrap', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*\.floating-socials\.is-phone-hidden \{[^}]*visibility: hidden;/);
  expect(css).toMatch(/\.product-badges \.tag \{[^}]*white-space: normal;/);
  const comp = readFileSync(new URL('../src/components/FloatingSocials.tsx', import.meta.url), 'utf8');
  expect(comp).toContain('IntersectionObserver');
  expect(comp).toContain('is-phone-hidden');
});
