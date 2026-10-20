import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appIcon = fileURLToPath(new URL('../src/app/icon.svg', import.meta.url));
const appFavicon = fileURLToPath(new URL('../src/app/favicon.ico', import.meta.url));
const publicFavicon = fileURLToPath(new URL('../public/favicon.ico', import.meta.url));
const layoutSource = readFileSync(fileURLToPath(new URL('../src/app/layout.tsx', import.meta.url)), 'utf8');

test('brand V monogram icon exists for Next app metadata and /favicon.ico', () => {
  expect(existsSync(appIcon)).toBe(true);
  expect(readFileSync(appIcon, 'utf8')).toContain('#176047');
  expect(readFileSync(appIcon, 'utf8')).toContain('#e7c77d');
  expect(existsSync(appFavicon)).toBe(true);
  expect(existsSync(publicFavicon)).toBe(true);
  expect(readFileSync(appFavicon).length).toBeGreaterThan(16);
  expect(layoutSource).toContain('/favicon.ico');
  expect(layoutSource).toContain('/icon.svg');
});
