import { expect, test } from 'bun:test';
import { fallbackProducts } from '../src/data/products.ts';
import {
  getProductSearchText,
  parseSearchTerms,
  productMatchesQuery,
} from '../src/lib/search-query.ts';
import { filterShopProducts, createShopFilters, getShopFilterOptions } from '../src/lib/shop-filters.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const listingSource = readFileSync(fileURLToPath(new URL('../src/components/SareeListing.tsx', import.meta.url)), 'utf8');
const bounds = getShopFilterOptions(fallbackProducts).priceBounds;
const allFilters = createShopFilters(bounds);

const withVariants = {
  id: 10,
  name: 'QA TEST – delete me',
  type: 'Kanchipuram pure silk',
  collection: 'Silk',
  price: 1000,
  colour: 'maroon',
  tag: 'Handloom certified',
  image: '/assets/saree-rose.webp',
  description: 'QA test product - safe to delete.',
  variants: [
    { name: 'maroon', colour: 'maroon', images: [] },
    { name: 'Gold', colour: 'Gold', images: [] },
  ],
};

test('parseSearchTerms splits on whitespace and ignores empties', () => {
  expect(parseSearchTerms('  Silk   emerald ')).toEqual(['silk', 'emerald']);
  expect(parseSearchTerms('')).toEqual([]);
  expect(parseSearchTerms('   ')).toEqual([]);
});

test('empty query matches every product', () => {
  expect(fallbackProducts.every((product) => productMatchesQuery(product, ''))).toBe(true);
  expect(fallbackProducts.every((product) => productMatchesQuery(product, '   '))).toBe(true);
});

test('search is case-insensitive across name, type, collection, colour, tag and description', () => {
  const malligai = fallbackProducts.find((product) => product.id === 4);
  expect(productMatchesQuery(malligai, 'Malligai')).toBe(true);
  expect(productMatchesQuery(malligai, 'malligai')).toBe(true);
  expect(productMatchesQuery(malligai, 'COTTON')).toBe(true);
  expect(productMatchesQuery(malligai, 'ivory')).toBe(true);
  expect(productMatchesQuery(malligai, 'everyday')).toBe(true);

  const demo = fallbackProducts.find((product) => product.id === 9);
  expect(productMatchesQuery(demo, 'demo')).toBe(true);
  expect(productMatchesQuery(demo, 'special edition')).toBe(true);
});

test('variant colour names are searchable', () => {
  expect(getProductSearchText(withVariants)).toContain('gold');
  expect(productMatchesQuery(withVariants, 'gold')).toBe(true);
  expect(productMatchesQuery(withVariants, 'Maroon')).toBe(true);
  expect(productMatchesQuery(withVariants, 'navy')).toBe(false);
});

test('multiple words are ANDed', () => {
  const silkEmerald = fallbackProducts.find((product) => product.id === 1);
  expect(productMatchesQuery(silkEmerald, 'silk emerald')).toBe(true);
  expect(productMatchesQuery(silkEmerald, 'silk cotton')).toBe(false);
  expect(productMatchesQuery(withVariants, 'qa gold')).toBe(true);
  expect(productMatchesQuery(withVariants, 'qa navy')).toBe(false);
});

test('unmatched queries return no products and distinct queries differ', () => {
  const silk = filterShopProducts(fallbackProducts, allFilters, 'silk');
  const qaCatalogue = [...fallbackProducts.filter((product) => product.id !== 10), withVariants];
  const qa = filterShopProducts(qaCatalogue, createShopFilters({ min: 0, max: 20_000 }), 'QA');
  const malligai = filterShopProducts(fallbackProducts, allFilters, 'Malligai');
  const none = filterShopProducts(fallbackProducts, allFilters, 'no-such-weave-xyz');

  expect(malligai.map((product) => product.id)).toEqual([4]);
  expect(qa.map((product) => product.id)).toEqual([10]);
  expect(productMatchesQuery(withVariants, 'QA')).toBe(true);
  expect(silk.some((product) => product.id === 4)).toBe(false);
  expect(silk.length).toBeGreaterThan(0);
  expect(none).toEqual([]);
  expect(silk.map((product) => product.id).join(',')).not.toBe(malligai.map((product) => product.id).join(','));
});

test('the unfiltered shop catalogue includes every product, including id 10', () => {
  const listed = filterShopProducts(fallbackProducts, allFilters);
  expect(listed).toHaveLength(fallbackProducts.length);
  expect(listed.map((product) => product.id)).toContain(10);
});

test('search page keeps q in the URL and shop/search list every matching product', () => {
  expect(listingSource).toContain("searchParams.get('q')");
  expect(listingSource).toContain("params.set('q'");
  expect(listingSource).not.toContain('visibleCount');
  expect(listingSource).toContain('sortedProducts.map');
  expect(listingSource).toContain('No sarees match your selection');
});
