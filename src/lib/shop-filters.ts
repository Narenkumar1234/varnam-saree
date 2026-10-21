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

/** The product's primary colour (colour variants are not offered on the storefront). */
export function getProductColours(product: Product): string[] {
  return typeof product.colour === 'string' && product.colour.trim() ? [product.colour.trim()] : [];
}

/**
 * Lists every distinct colour text entered by owners across published products' primary colours,
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

/** Minimal read interface so both URLSearchParams and Next's ReadonlyURLSearchParams work. */
interface ParamReader {
  get(name: string): string | null;
  getAll(name: string): string[];
}

const SHOP_FILTER_PARAM_KEYS = ['collection', 'colour', 'color', 'min', 'max', 'offers', 'discount'];

/**
 * Read shop filters from the URL: ?collection=Silk&colour=Emerald,Rose&min=2000&max=9000&offers=25
 * Colours match the primary-colour options case-insensitively (repeated or comma-separated).
 */
export function parseShopFiltersFromParams(
  params: ParamReader,
  options: { collections: string[]; colours: string[]; priceBounds: PriceRange },
): ShopFilterState {
  const { collections, colours, priceBounds } = options;
  const rawCollection = params.get('collection');
  const collection = rawCollection
    ? collections.find((c) => c.toLowerCase() === rawCollection.trim().toLowerCase()) || 'All'
    : 'All';

  const requestedColours = [...params.getAll('colour'), ...params.getAll('color')]
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  const selectedColours: string[] = [];
  for (const requested of requestedColours) {
    const key = colourKey(requested);
    const canonical = colours.find((c) => colourKey(c) === key) || formatColourTitleCase(requested);
    if (!selectedColours.some((c) => colourKey(c) === colourKey(canonical))) selectedColours.push(canonical);
  }

  const parseBound = (value: string | null) => {
    if (value == null || value.trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const urlMin = parseBound(params.get('min'));
  const urlMax = parseBound(params.get('max'));
  const min = Math.max(priceBounds.min, Math.min(urlMin ?? priceBounds.min, priceBounds.max));
  const max = Math.max(min, Math.min(urlMax ?? priceBounds.max, priceBounds.max));

  const offers = params.get('offers') || params.get('discount');
  const minDiscount = offers ? (parseInt(offers, 10) || 50) : 0;

  return { collection, colours: selectedColours, priceRange: { min, max }, minDiscount: Math.max(0, minDiscount) };
}

/**
 * Write shop filters into a copy of the current params (other params such as ?q= are kept).
 * Defaults are omitted so an unfiltered shop stays at a clean /shop URL.
 */
export function shopFiltersToParams(
  filters: ShopFilterState,
  priceBounds: PriceRange,
  current: string | URLSearchParams = '',
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  for (const key of SHOP_FILTER_PARAM_KEYS) params.delete(key);
  if (filters.collection && filters.collection !== 'All') params.set('collection', filters.collection);
  if (filters.colours.length) params.set('colour', filters.colours.join(','));
  if (filters.priceRange.min > priceBounds.min) params.set('min', String(filters.priceRange.min));
  if (filters.priceRange.max < priceBounds.max) params.set('max', String(filters.priceRange.max));
  if (filters.minDiscount && filters.minDiscount > 0) params.set('offers', String(filters.minDiscount));
  return params;
}

/** Stable comparison key for two filter states. */
export function shopFiltersKey(filters: ShopFilterState): string {
  return JSON.stringify([
    filters.collection,
    filters.colours.map(colourKey).sort(),
    filters.priceRange.min,
    filters.priceRange.max,
    filters.minDiscount || 0,
  ]);
}

export type ShopSortOption = 'featured' | 'low' | 'high' | 'new';
export const SHOP_SORT_OPTIONS: ShopSortOption[] = ['featured', 'low', 'high', 'new'];

/** Read ?sort= (featured is the default and is never written to the URL). */
export function parseShopSortFromParams(params: Pick<ParamReader, 'get'>): ShopSortOption {
  const raw = (params.get('sort') || '').trim().toLowerCase();
  return (SHOP_SORT_OPTIONS as string[]).includes(raw) ? (raw as ShopSortOption) : 'featured';
}

/** Full shop query: filters plus sort, keeping unrelated params such as ?q=. */
export function shopStateToParams(
  filters: ShopFilterState,
  sort: ShopSortOption,
  priceBounds: PriceRange,
  current: string | URLSearchParams = '',
): URLSearchParams {
  const params = shopFiltersToParams(filters, priceBounds, current);
  params.delete('sort');
  if (sort !== 'featured') params.set('sort', sort);
  return params;
}
