import type { Product } from '@/types';

function normalizeSearchValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Searchable catalogue text: name, type, collection, primary colour, tag, description. */
export function getProductSearchText(product: Product): string {
  return [
    product.name,
    product.type,
    product.collection,
    product.colour,
    product.tag,
    product.description,
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
 * name, type, collection, primary colour, tag and description.
 */
export function productMatchesQuery(product: Product, query = ''): boolean {
  const terms = parseSearchTerms(query);
  if (!terms.length) return true;
  const haystack = getProductSearchText(product);
  return terms.every((term) => haystack.includes(term));
}
