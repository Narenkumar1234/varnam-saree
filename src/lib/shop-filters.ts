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
