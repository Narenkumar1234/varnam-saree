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

export function createShopFilters(priceBounds: PriceRange, collection = 'All'): ShopFilterState {
  return { collection, colours: [], priceRange: { ...priceBounds } };
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
      filters.colours.includes(product.colour);
    const matchesPrice = product.price >= filters.priceRange.min &&
      product.price <= filters.priceRange.max;

    return matchesQuery && matchesCollection && matchesColour && matchesPrice;
  });
}
