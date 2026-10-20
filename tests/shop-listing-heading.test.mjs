import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getShopListingHeading } from '../src/lib/shop-filters.ts';

const listingSource = readFileSync(fileURLToPath(new URL('../src/components/SareeListing.tsx', import.meta.url)), 'utf8');
const searchSource = readFileSync(fileURLToPath(new URL('../src/app/search/page.tsx', import.meta.url)), 'utf8');

test('shop listing heading covers offers, collection, all sarees, and skips search mode', () => {
  expect(getShopListingHeading(20, 'All')).toBe('Offers · 20%+ OFF');
  expect(getShopListingHeading(0, 'Silk')).toBe('Silk sarees');
  expect(getShopListingHeading(0, 'All')).toBe('All sarees');
  expect(getShopListingHeading(50, 'Silk', true)).toBeNull();
});

test('SareeListing renders one page-title h1 from the shared heading helper', () => {
  expect(listingSource).toContain('getShopListingHeading(');
  expect(listingSource).toContain('className="page-title shop-listing-title"');
  expect(listingSource).toContain('<h1>{listingHeading}</h1>');
  expect(listingSource).toContain('{listingHeading && (');
  expect(searchSource).toContain('<h1');
  expect(searchSource).toContain('Find your colours');
});
