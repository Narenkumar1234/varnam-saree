import type { PriceRange, Product, ShopFilterState } from '@/types';
import { productMatchesQuery } from '@/lib/search-query';

/** Friendly title case for colour names: words capitalized, normalized spacing. */
export function formatColourTitleCase(value: string): string {
  if (!value) return '';
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized
    .toLowerCase()
    .replace(/(?:^|[\s-/])\w/g, (match) => match.toUpperCase());
}

/** Case-insensitive, whitespace-normalised comparison key for colour text. */
export function colourKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Extract all trimmed colour candidates from a product and its variants. */
export function getProductColours(product: Product): string[] {
  const colours: string[] = [];
  if (typeof product.colour === 'string' && product.colour.trim()) {
    colours.push(product.colour.trim());
  }
  if (Array.isArray(product.variants)) {
    for (const v of product.variants) {
      if (v) {
        if (typeof v.colour === 'string' && v.colour.trim()) {
          colours.push(v.colour.trim());
        }
        if (typeof v.name === 'string' && v.name.trim()) {
          colours.push(v.name.trim());
        }
      }
    }
  }
  return colours;
}

/**
 * Lists every distinct colour text entered by owners across published products/variants,
 * trimmed, de-duplicated case-insensitively, shown in friendly title case, and sorted alphabetically.
 */
export function getShopColours(catalogue: Product[]): string[] {
  const map = new Map<string, string>();
  for (const product of catalogue || []) {
    const candidates = getProductColours(product);
    for (const raw of candidates) {
      const trimmed = raw.trim().replace(/\s+/g, ' ');
      if (!trimmed) continue;
      const key = colourKey(trimmed);
      if (!map.has(key)) {
        map.set(key, formatColourTitleCase(trimmed));
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

export function getShopFilterOptions(catalogue: Product[]) {
  const prices = (catalogue || []).map((product) => product.price);

  return {
    collections: ['All', ...new Set([
      ...(catalogue || []).map((product) => product.collection).filter((collection) => collection && collection !== 'All'),
    ])],
    colours: getShopColours(catalogue),
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

/** Shop breadcrumb/heading for `?offers=N` (products with discount >= N). */
export function getShopOffersHeading(minDiscount: number): string | null {
  return minDiscount > 0 ? `Offers · ${minDiscount}%+ OFF` : null;
}

/** Visible shop listing title. Search mode is handled by the search page h1. */
export function getShopListingHeading(
  minDiscount: number,
  collection: string,
  searchMode = false,
): string | null {
  if (searchMode) return null;
  return getShopOffersHeading(minDiscount) ?? (collection === 'All' ? 'All sarees' : `${collection} sarees`);
}

export function createShopFilters(priceBounds: PriceRange, collection = 'All'): ShopFilterState {
  return { collection, colours: [], priceRange: { ...priceBounds }, minDiscount: 0 };
}

export function filterShopProducts(
  catalogue: Product[],
  filters: ShopFilterState,
  query = ''
): Product[] {
  return catalogue.filter((product) => {
    const matchesQuery = productMatchesQuery(product, query);
    const matchesCollection = filters.collection === 'All' ||
      product.collection === filters.collection;
    const productColours = getProductColours(product);
    const matchesColour = !filters.colours.length ||
      filters.colours.some((selected) => {
        const target = colourKey(selected);
        return productColours.some((pc) => colourKey(pc) === target);
      });
    const matchesPrice = product.price >= filters.priceRange.min &&
      product.price <= filters.priceRange.max;
    const matchesDiscount = !filters.minDiscount ||
      getProductDiscountPercentage(product) >= filters.minDiscount;

    return matchesQuery && matchesCollection && matchesColour && matchesPrice && matchesDiscount;
  });
}
