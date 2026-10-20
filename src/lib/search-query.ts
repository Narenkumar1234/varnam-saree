import type { Product } from '@/types';

function normalizeSearchValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Searchable catalogue text: name, type, collection, colour, variant colours, tag, description. */
export function getProductSearchText(product: Product): string {
  const variantColours = (product.variants ?? []).flatMap((variant) => [
    variant.name,
    variant.colour,
  ]);

  return [
    product.name,
    product.type,
    product.collection,
    product.colour,
    product.tag,
    product.description,
    ...variantColours,
  ]
    .map(normalizeSearchValue)
    .filter(Boolean)
    .join(' ');
}

export function parseSearchTerms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Case-insensitive catalogue match. Multiple words are ANDed across
 * name, type, collection, colour, variant colour names, tag and description.
 */
export function productMatchesQuery(product: Product, query = ''): boolean {
  const terms = parseSearchTerms(query);
  if (!terms.length) return true;
  const haystack = getProductSearchText(product);
  return terms.every((term) => haystack.includes(term));
}
