import { expect, test } from 'bun:test';
import {
  filterShopProducts,
  createShopFilters,
  getMaxProductDiscount,
  getOffersNav,
  getProductDiscountPercentage,
  getShopOffersHeading,
} from '../src/lib/shop-filters.ts';

const product = (id, price, oldPrice) => ({
  id,
  name: `Saree ${id}`,
  type: 'Silk',
  collection: 'Silk',
  price,
  oldPrice,
  colour: 'Emerald',
  image: '/assets/saree-emerald.webp',
});

const catalogue = [
  product(1, 8000, 10000), // 20%
  product(2, 9000, 10000), // 10%
  product(3, 5000, null),  // none
];

test('max product discount ignores coupons and unused catalogue items', () => {
  expect(getMaxProductDiscount(catalogue)).toBe(20);
  expect(getMaxProductDiscount([product(3, 5000, null)])).toBe(0);
  expect(getMaxProductDiscount([])).toBe(0);
});

test('offers link uses only the max product discount so the shop filter is never empty', () => {
  const coupon = { code: 'OFFER50', percentage: 50 };
  const nav = getOffersNav(getMaxProductDiscount(catalogue), coupon);

  expect(nav.visible).toBe(true);
  expect(nav.href).toBe('/shop?offers=20');
  expect(nav.badge).toBe('up to 20% OFF');
  expect(nav.ariaLabel).toBe('Offers: up to 20% off');

  const minDiscount = Number(new URL(nav.href, 'https://varnam.example').searchParams.get('offers'));
  const matches = filterShopProducts(catalogue, { ...createShopFilters({ min: 0, max: 10000 }), minDiscount });
  expect(matches.map((item) => item.id)).toEqual([1]);
  expect(matches.every((item) => getProductDiscountPercentage(item) >= minDiscount)).toBe(true);
  expect(getShopOffersHeading(minDiscount)).toBe('Offers · 20%+ OFF');
});

test('coupon-only offers link to /shop and show the coupon instead of an empty product filter', () => {
  const nav = getOffersNav(0, { code: 'OFFER50', percentage: 50 });
  expect(nav).toEqual({
    visible: true,
    href: '/shop',
    badge: 'OFFER50 50% OFF',
    ariaLabel: 'Offers: OFFER50 50% off',
  });
  expect(getShopOffersHeading(0)).toBeNull();
});

test('offers link is hidden when there is no product discount and no valid coupon', () => {
  expect(getOffersNav(0, null)).toEqual({ visible: false });
  expect(getOffersNav(0, { code: 'OFFER50', percentage: 0 })).toEqual({ visible: false });
});

test('shop ?offers=N heading matches discount >= N filtering', () => {
  for (const minDiscount of [10, 20, 50]) {
    const matches = filterShopProducts(catalogue.concat(product(4, 4000, 10000)), {
      ...createShopFilters({ min: 0, max: 10000 }),
      minDiscount,
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((item) => getProductDiscountPercentage(item) >= minDiscount)).toBe(true);
    expect(getShopOffersHeading(minDiscount)).toBe(`Offers · ${minDiscount}%+ OFF`);
  }
});
