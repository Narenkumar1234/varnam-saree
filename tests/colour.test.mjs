import { expect, test } from 'bun:test';
import { COLOUR_HEX_MAP, NEUTRAL_SWATCH_HEX, resolveColourHex } from '../src/lib/colour.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const detailSource = readFileSync(fileURLToPath(new URL('../src/components/ProductDetail.tsx', import.meta.url)), 'utf8');

const REQUIRED_COLOURS = [
  'maroon', 'gold', 'ivory', 'cream', 'off-white', 'red', 'pink', 'rose', 'peach',
  'orange', 'mustard', 'yellow', 'green', 'emerald', 'bottle green', 'mint', 'teal',
  'blue', 'navy', 'royal blue', 'sky blue', 'purple', 'violet', 'lavender', 'magenta',
  'wine', 'brown', 'beige', 'black', 'white', 'grey', 'silver', 'copper',
];

test('maps every requested saree colour to a distinct hex', () => {
  for (const name of REQUIRED_COLOURS) {
    const hex = resolveColourHex(name);
    expect(hex).toMatch(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    expect(hex).not.toBe(NEUTRAL_SWATCH_HEX);
  }
  expect(resolveColourHex('maroon')).not.toBe(resolveColourHex('gold'));
  expect(resolveColourHex('Emerald')).toBe(COLOUR_HEX_MAP.emerald);
  expect(resolveColourHex('Ivory')).toBe(COLOUR_HEX_MAP.ivory);
});

test('matches colour names case-insensitively and partially', () => {
  expect(resolveColourHex('Maroon')).toBe(resolveColourHex('maroon'));
  expect(resolveColourHex('GOLD')).toBe(resolveColourHex('gold'));
  expect(resolveColourHex('Maroon Red')).toBe(resolveColourHex('maroon'));
  expect(resolveColourHex('deep bottle green border')).toBe(resolveColourHex('bottle green'));
  expect(resolveColourHex('Royal Blue')).toBe(resolveColourHex('royal blue'));
  expect(resolveColourHex('off white')).toBe(resolveColourHex('off-white'));
});

test('prefers an explicit variant hex and falls back to a named neutral', () => {
  expect(resolveColourHex('Maroon', '#ff00aa')).toBe('#ff00aa');
  expect(resolveColourHex('Maroon', '#ABC')).toBe('#ABC');
  expect(resolveColourHex('Gold', 'not-a-colour')).toBe(resolveColourHex('gold'));
  expect(resolveColourHex('#bada55')).toBe('#bada55');
  expect(resolveColourHex('chartreuse mist')).toBe(NEUTRAL_SWATCH_HEX);
  expect(resolveColourHex('')).toBe(NEUTRAL_SWATCH_HEX);
  expect(resolveColourHex(null)).toBe(NEUTRAL_SWATCH_HEX);
});

test('product page shows the primary colour as text with no swatch picker', () => {
  expect(detailSource).toContain('Colour: {capitalizeColour(product.colour)}');
  expect(detailSource).not.toContain('resolveColourHex(');
  expect(detailSource).not.toContain('swatch');
  expect(detailSource).toContain('Estimated delivery in 5–7 business days.');
  expect(detailSource).not.toContain('Demo estimate');
});
