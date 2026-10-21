import { describe, expect, test } from 'bun:test';
import {
  formatColourTitleCase,
  getProductColours,
  getShopColours,
  getShopFilterOptions,
  filterShopProducts,
  createShopFilters,
} from '../src/lib/shop-filters.ts';

describe('Shop colour filters', () => {
  const sampleProducts = [
    {
      id: 1,
      name: 'Mayil emerald silk saree',
      type: 'Kanchipuram silk',
      collection: 'Silk',
      price: 8490,
      colour: '  emerald  ',
      tag: 'Bestseller',
      image: '/assets/saree-emerald.webp',
      variants: [
        { name: 'ruby red', colour: 'ruby red', images: [] },
        { name: 'GOLD', colour: 'GOLD', images: [] },
      ],
    },
    {
      id: 2,
      name: 'Gulabi rose Banarasi saree',
      type: 'Banarasi silk',
      collection: 'Silk',
      price: 6290,
      colour: 'Rose',
      tag: 'New arrival',
      image: '/assets/saree-rose.webp',
      variants: [
        { name: 'bottle green', colour: 'bottle-green', images: [] },
      ],
    },
    {
      id: 3,
      name: 'Neelam midnight silk saree',
      type: 'Soft silk',
      collection: 'Festive',
      price: 7490,
      colour: 'EMERALD',
      tag: '',
      image: '/assets/saree-indigo.webp',
    },
    {
      id: 4,
      name: 'Malligai ivory cotton saree',
      type: 'Handloom cotton',
      collection: 'Cotton',
      price: 2490,
      colour: 'off-white',
      tag: '',
      image: '/assets/saree-ivory.webp',
    },
    {
      id: 5,
      name: 'Blank colour product',
      type: 'Silk',
      collection: 'Silk',
      price: 5000,
      colour: '',
      tag: '',
      image: '/assets/saree-emerald.webp',
      variants: [
        { name: '', colour: '', images: [] },
      ],
    },
  ];

  test('formatColourTitleCase converts words to friendly title case', () => {
    expect(formatColourTitleCase('emerald')).toBe('Emerald');
    expect(formatColourTitleCase('EMERALD')).toBe('Emerald');
    expect(formatColourTitleCase('ruby red')).toBe('Ruby Red');
    expect(formatColourTitleCase('RUBY RED')).toBe('Ruby Red');
    expect(formatColourTitleCase('bottle-green')).toBe('Bottle-Green');
    expect(formatColourTitleCase('off-white')).toBe('Off-White');
    expect(formatColourTitleCase('  royal   blue  ')).toBe('Royal Blue');
    expect(formatColourTitleCase('')).toBe('');
    expect(formatColourTitleCase('   ')).toBe('');
  });

  test('getProductColours returns only the trimmed primary colour (variants are ignored)', () => {
    expect(getProductColours(sampleProducts[0])).toEqual(['emerald']);
    expect(getProductColours(sampleProducts[4])).toEqual([]);
  });

  test('getShopColours lists trimmed, case-insensitively de-duplicated, title-cased, alphabetically sorted primary colours', () => {
    const colours = getShopColours(sampleProducts);
    // Primary colours only; variant colours (Ruby Red, Gold, Bottle-Green) are not listed. Blank is skipped.
    expect(colours).toEqual(['Emerald', 'Off-White', 'Rose']);
    expect(colours).not.toContain('Ruby Red');
    expect(colours).not.toContain('Gold');

    // Case-insensitively de-duplicated: Emerald appears only once
    expect(colours.filter((c) => c.toLowerCase() === 'emerald')).toHaveLength(1);

    // Sorted alphabetically
    const sorted = [...colours].sort((a, b) => a.localeCompare(b));
    expect(colours).toEqual(sorted);
  });

  test('getShopFilterOptions includes the dynamic colours array', () => {
    const options = getShopFilterOptions(sampleProducts);
    expect(options.colours).toEqual(getShopColours(sampleProducts));
    expect(options.collections).toContain('Silk');
    expect(options.priceBounds.min).toBe(2490);
    expect(options.priceBounds.max).toBe(8490);
  });

  test('filterShopProducts matches colours case-insensitively against product colour', () => {
    const filters = {
      ...createShopFilters({ min: 0, max: 10000 }),
      colours: ['emerald'],
    };
    const results = filterShopProducts(sampleProducts, filters);
    // Product 1 ('  emerald  ') and Product 3 ('EMERALD') match
    expect(results.map((p) => p.id)).toContain(1);
    expect(results.map((p) => p.id)).toContain(3);
    expect(results.map((p) => p.id)).not.toContain(4);
  });

  test('filterShopProducts does not match variant colours', () => {
    const filters = {
      ...createShopFilters({ min: 0, max: 10000 }),
      colours: ['Ruby Red'],
    };
    // Product 1 has a legacy variant 'ruby red', but only primary colours count
    expect(filterShopProducts(sampleProducts, filters)).toEqual([]);
  });

  test('filterShopProducts matches multiple selected colours', () => {
    const filters = {
      ...createShopFilters({ min: 0, max: 10000 }),
      colours: ['ROSE', 'off-white'],
    };
    const results = filterShopProducts(sampleProducts, filters);
    expect(results.map((p) => p.id)).toContain(2);
    expect(results.map((p) => p.id)).toContain(4);
    expect(results.map((p) => p.id)).not.toContain(3);
  });

  test('filterShopProducts returns all products when no colours selected', () => {
    const filters = createShopFilters({ min: 0, max: 10000 });
    const results = filterShopProducts(sampleProducts, filters);
    expect(results).toHaveLength(sampleProducts.length);
  });
});

test('filterShopProducts ignores extra internal whitespace when matching colours', () => {
  const products = [{ id: 9, name: 'x', type: 'Silk', collection: 'Silk', price: 100, colour: 'royal   Blue', tag: '', image: '/a.webp' }];
  const filters = { ...createShopFilters({ min: 0, max: 1000 }), colours: ['Royal Blue'] };
  expect(filterShopProducts(products, filters).map((p) => p.id)).toEqual([9]);
});
