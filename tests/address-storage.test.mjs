import { expect, test } from 'bun:test';
import { ADDRESS_FIELDS, ADDRESS_STORAGE_KEY, EMPTY_ADDRESS, decodeSavedAddress, readSavedAddress, saveAddress } from '../src/lib/address-storage.ts';

const legacyLabelKey = 'varnam-address-label';
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values };
}
const structured = { label: 'Work', first: 'Test', last: 'Customer', phone: '9000000000', address: '12, Rose Street', city: 'Chennai', pin: '600001', state: 'Tamil Nadu' };

test('legacy address text and nickname migrate into a single JSON record without guessing fields', () => {
  const storage = memoryStorage({ [ADDRESS_STORAGE_KEY]: '12, Rose Street\nChennai 600001', [legacyLabelKey]: 'Work' });
  const result = readSavedAddress(storage);
  expect(result).toEqual({ ...EMPTY_ADDRESS, label: 'Work', address: '12, Rose Street, Chennai 600001' });
  expect(result.first).toBe(''); expect(result.city).toBe(''); expect(result.pin).toBe('');
  expect(JSON.parse(storage.getItem(ADDRESS_STORAGE_KEY))).toEqual(result);
  expect(storage.getItem(legacyLabelKey)).toBeNull();
  expect(readSavedAddress(storage)).toEqual(result);
});

test('structured data round-trips all checkout fields and the nickname, preserving pincode strings', () => {
  const storage = memoryStorage({ [legacyLabelKey]: 'Old label' });
  expect(saveAddress(structured, storage)).toBe(true);
  expect(readSavedAddress(storage)).toEqual(structured);
  expect(JSON.parse(storage.getItem(ADDRESS_STORAGE_KEY))).toEqual(structured);
  expect(storage.getItem(legacyLabelKey)).toBeNull();
  for (const field of ADDRESS_FIELDS) expect(typeof readSavedAddress(storage)[field]).toBe('string');
});

test('partial structured addresses get blank missing fields and unknown fields are not imported', () => {
  const saved = decodeSavedAddress(JSON.stringify({ first: ' Test ', address: 'Street', pin: 600001, email: 'private@example.test', admin: true }));
  expect(saved).toEqual({ ...EMPTY_ADDRESS, label: 'Home', first: 'Test', address: 'Street' });
  expect(saved).not.toHaveProperty('email'); expect(saved).not.toHaveProperty('admin');
});

test('JSON-string and numeric legacy address lines are preserved without numeric rounding', () => {
  expect(decodeSavedAddress(JSON.stringify('Flat 2\nRose Street')).address).toBe('Flat 2, Rose Street');
  expect(decodeSavedAddress('12345678901234567890').address).toBe('12345678901234567890');
  expect(decodeSavedAddress('{Flat 2}').address).toBe('{Flat 2}');
});

test('missing/unrecognised data stays absent so guest checkout can remain blank', () => {
  for (const raw of [null, '', ' ', 'null', '[]', '{"unknown":true}']) expect(decodeSavedAddress(raw)).toBeNull();
  expect(readSavedAddress(memoryStorage())).toBeNull();
  expect(readSavedAddress(null)).toBeNull(); expect(saveAddress(structured, null)).toBe(false);
});

test('a blocked migration write still returns the legacy address for prefill and leaves old data intact', () => {
  const storage = memoryStorage({ [ADDRESS_STORAGE_KEY]: 'Street', [legacyLabelKey]: 'Home' });
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  expect(readSavedAddress(storage).address).toBe('Street');
  expect(storage.getItem(ADDRESS_STORAGE_KEY)).toBe('Street');
  expect(storage.getItem(legacyLabelKey)).toBe('Home');
  expect(saveAddress(structured, storage)).toBe(false);
});

test('storage read failures do not throw and failed saves report failure', () => {
  const blocked = { getItem: () => { throw new Error('Storage disabled'); }, setItem: () => { throw new Error('Storage disabled'); }, removeItem: () => {} };
  expect(readSavedAddress(blocked)).toBeNull(); expect(saveAddress(structured, blocked)).toBe(false);
});

test('editing an imported address replaces the same record with structured checkout fields', () => {
  const storage = memoryStorage({ [ADDRESS_STORAGE_KEY]: 'Legacy address' });
  const migrated = readSavedAddress(storage);
  expect(saveAddress({ ...migrated, ...structured }, storage)).toBe(true);
  expect(readSavedAddress(storage)).toEqual(structured);
});
