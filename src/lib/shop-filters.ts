import type { PriceRange, Product, ShopFilterState } from '@/types';

export function getShopFilterOptions(catalogue: Product[]) {
  const prices = catalogue.map((product) => product.price);

  return {
    collections: ['All', ...new Set([
      ...catalogue.map((product) => product.collection).filter((collection) => collection && collection !== 'All'),
    ])],
    priceBounds: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
  };
}

export const DISCOUNT_FILTER_OPTIONS = [
  { label: 'All', value: 0 },
  { label: '10%+ off', value: 10 },
  { label: '25%+ off', value: 25 },
  { label: '50%+ off', value: 50 },
];

export function getProductDiscountPercentage(product: Product): number {
  if (product.oldPrice && product.oldPrice > product.price) {
    return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
  }
  return 0;
}

export function getMaxProductDiscount(catalogue: Product[]): number {
  const discounts = (catalogue || []).map(getProductDiscountPercentage).filter((pct) => pct > 0);
  return discounts.length > 0 ? Math.max(...discounts) : 0;
}

export type OffersNav =
  | { visible: false }
  | { visible: true; href: string; badge: string | null; ariaLabel: string };

export function getOffersNav(
  maxProductDiscount: number,
  coupon?: { code: string; percentage: number } | null
): OffersNav {
  if (maxProductDiscount > 0) {
    return {
      visible: true,
      href: `/shop?offers=${maxProductDiscount}`,
      badge: `up to ${maxProductDiscount}% OFF`,
      ariaLabel: `Offers: up to ${maxProductDiscount}% off`,
    };
  }
  if (coupon && coupon.percentage > 0) {
    return {
      visible: true,
      href: '/shop',
      badge: `${coupon.code} ${coupon.percentage}% OFF`,
      ariaLabel: `Offers: ${coupon.code} ${coupon.percentage}% off`,
    };
  }
  return { visible: false };
}

/** Shop breadcrumb for `?offers=N` (products with discount >= N). */
export function getShopOffersHeading(minDiscount: number): string | null {
  return minDiscount > 0 ? `Offers · ${minDiscount}%+ OFF` : null;
}

export function createShopFilters(priceBounds: PriceRange, collection = 'All'): ShopFilterState {
  return { collection, colours: [], priceRange: { ...priceBounds }, minDiscount: 0 };
}

export function filterShopProducts(
  catalogue: Product[],
  filters: ShopFilterState,
  query = ''
): Product[] {
  const search = query.trim().toLowerCase();

  return catalogue.filter((product) => {
    const matchesQuery = !search ||
      `${product.name} ${product.type} ${product.collection} ${product.colour}`
        .toLowerCase().includes(search);
    const matchesCollection = filters.collection === 'All' ||
      product.collection === filters.collection;
    const matchesColour = !filters.colours.length ||
      filters.colours.some((c) => c.toLowerCase() === product.colour.toLowerCase());
    const matchesPrice = product.price >= filters.priceRange.min &&
      product.price <= filters.priceRange.max;
    const matchesDiscount = !filters.minDiscount ||
      getProductDiscountPercentage(product) >= filters.minDiscount;

    return matchesQuery && matchesCollection && matchesColour && matchesPrice && matchesDiscount;
  });
}
