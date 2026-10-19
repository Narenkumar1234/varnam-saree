import { expect, test } from 'bun:test';
import { FirebaseConfigError, getFirebasePublicConfig } from '../src/lib/firebase-config.ts';
import { mapCustomerAuthError } from '../src/lib/customer-auth-errors.ts';

const fixture = { apiKey: 'public-test-fixture', authDomain: 'test-project.firebaseapp.com', projectId: 'test-project', appId: 'public-test-app' };
test('public Firebase configuration has no fallback to a committed generic project', () => {
  expect(() => getFirebasePublicConfig({})).toThrow(FirebaseConfigError);
  for (const field of Object.keys(fixture)) expect(() => getFirebasePublicConfig({ ...fixture, [field]: '' })).toThrow(FirebaseConfigError);
  expect(getFirebasePublicConfig(fixture)).toEqual(fixture);
});
test('default Firebase auth domain must belong to the configured browser project', () => {
  try {
    getFirebasePublicConfig({ ...fixture, authDomain: 'other-project.firebaseapp.com' });
    throw new Error('Must fail');
  } catch (error) { expect(mapCustomerAuthError(error).code).toBe('CUSTOMER_AUTH_PROJECT_MISMATCH'); }
  expect(() => getFirebasePublicConfig({ ...fixture, authDomain: 'https://test-project.firebaseapp.com/path' })).toThrow(FirebaseConfigError);
  expect(getFirebasePublicConfig({ ...fixture, authDomain: 'auth.store.example' }).authDomain).toBe('auth.store.example');
});
