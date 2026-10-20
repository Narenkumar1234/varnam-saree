import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { EMPTY_ADDRESS, isAddressFormOpen } from '../src/lib/address-storage.ts';
import {
  INDIAN_MOBILE_PATTERN, INDIAN_MOBILE_PATTERN_MESSAGE, PINCODE_PATTERN, PINCODE_PATTERN_MESSAGE,
  normalizeIndianMobile, normalizePincode,
} from '../src/lib/address-validation.ts';
import { ADDRESS_FIELD_INPUTS, AddressFields } from '../src/components/AddressFields.tsx';

const checkoutSource = readFileSync(fileURLToPath(new URL('../src/app/checkout/page.tsx', import.meta.url)), 'utf8');
const addressFieldsSource = readFileSync(fileURLToPath(new URL('../src/components/AddressFields.tsx', import.meta.url)), 'utf8');
const addressesSource = readFileSync(fileURLToPath(new URL('../src/app/addresses/page.tsx', import.meta.url)), 'utf8');
const productDetailSource = readFileSync(fileURLToPath(new URL('../src/components/ProductDetail.tsx', import.meta.url)), 'utf8');

function patternsFromSource(source) {
  return [...source.matchAll(/\bpattern=["']([^"']+)["']/g)].map((match) => match[1]);
}

function patternsFromMarkup(markup) {
  return [...markup.matchAll(/\spattern="([^"]*)"/g)].map((match) => match[1]);
}

test('the previous phone character class is invalid under the HTML v flag', () => {
  expect(() => new RegExp('[0-9+ ()\\-]{10,16}', 'v')).toThrow();
});

test('every pattern attribute used in AddressFields and checkout compiles with the v flag', () => {
  const markup = renderToStaticMarkup(createElement(AddressFields, { value: EMPTY_ADDRESS, onChange() {} }));
  const fromInputs = Object.values(ADDRESS_FIELD_INPUTS).map((field) => field.pattern).filter(Boolean);
  const patterns = [...new Set([
    ...fromInputs,
    ...patternsFromMarkup(markup),
    ...patternsFromSource(addressFieldsSource),
    ...patternsFromSource(checkoutSource),
  ])];
  expect(fromInputs).toContain(INDIAN_MOBILE_PATTERN);
  expect(fromInputs).toContain(PINCODE_PATTERN);
  expect(patterns.length).toBeGreaterThan(0);
  expect(markup).toContain(`title="${INDIAN_MOBILE_PATTERN_MESSAGE}"`);
  expect(markup).toContain(`title="${PINCODE_PATTERN_MESSAGE}"`);
  for (const pattern of patterns) {
    expect(() => new RegExp(pattern, 'v')).not.toThrow();
  }
});

test('the HTML phone pattern accepts the same prefixes and spaces the server normalises', () => {
  const regex = new RegExp(`^(?:${INDIAN_MOBILE_PATTERN})$`, 'v');
  for (const value of ['9876543210', '+919876543210', '+91 9876543210', '+91 98765 43210', '919876543210', '09876543210']) {
    expect(regex.test(value)).toBe(true);
    expect(normalizeIndianMobile(value)).toBe('9876543210');
  }
  for (const value of ['5123456789', '987654321', 'abc', '+91 5123456789']) {
    expect(regex.test(value)).toBe(false);
  }
  expect(new RegExp(`^(?:${PINCODE_PATTERN})$`, 'v').test('600001')).toBe(true);
  expect(normalizePincode('600001')).toBe('600001');
});

test('the add-address form has Cancel, an optional nickname, and does not force Home', () => {
  expect(addressesSource).toContain("label: ''");
  expect(addressesSource).not.toContain("label: 'Home'");
  expect(addressesSource).toContain('placeholder="Home / Office"');
  expect(addressesSource).toContain('Address nickname (optional)');
  expect(addressesSource).toMatch(/onClick=\{resetForm\}/);
  expect(addressesSource).toContain('>Cancel<');
  expect(addressesSource).toContain('Add address');
  expect(addressesSource).toContain('isAddressFormOpen(');
  expect(addressesSource).not.toContain('{editingId &&');
});

test('the add form stays open with zero addresses and hides behind Add address once one is saved', () => {
  expect(isAddressFormOpen(0, false)).toBe(true);
  expect(isAddressFormOpen(1, false)).toBe(false);
  expect(isAddressFormOpen(1, true)).toBe(true);
  expect(isAddressFormOpen(2, false, true)).toBe(true);
  expect(isAddressFormOpen(1, false, false)).toBe(false);
});

test('every pincode validation message is the shared copy with a trailing full stop', () => {
  expect(PINCODE_PATTERN_MESSAGE).toBe('Enter a 6-digit pincode.');
  expect(PINCODE_PATTERN_MESSAGE.endsWith('.')).toBe(true);
  expect(productDetailSource).toContain('PINCODE_PATTERN_MESSAGE');
  expect(productDetailSource).toContain('setPinMessage(PINCODE_PATTERN_MESSAGE)');
  expect(productDetailSource).not.toContain('Please enter a valid 6-digit pincode');
  expect(addressFieldsSource).toContain('PINCODE_PATTERN_MESSAGE');
});
