import { expect, mock, test, afterAll } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCustomerAccount, initialCustomerAccountState } from '../src/lib/customer-account.ts';
import { authIssue, mapCustomerAuthError } from '../src/lib/customer-auth-errors.ts';

const alice = { uid: 'alice', getIdToken: async () => 'test-alice-token' };
const bob = { uid: 'bob', getIdToken: async () => 'test-bob-token' };
const profiles = {
  alice: { uid: 'alice', email: 'alice@example.test', name: 'Alice' },
  bob: { uid: 'bob', email: 'bob@example.test', name: 'Bob' },
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function harness(restored = null) {
  let user = restored, observe, popupCalls = 0, signOutCalls = 0;
  const requests = [], states = [], flags = {};
  const controller = createCustomerAccount({
    observe: (next) => { observe = next; next(user); return () => { observe = null; }; },
    currentUser: () => user,
    popup: async () => {
      popupCalls++;
      if (flags.popupError) throw flags.popupError;
      user = alice;
      if (flags.emitPopup) observe(user);
      return { user };
    },
    signOut: async () => { signOutCalls++; user = null; observe?.(null); },
    fetch: async (path, options) => {
      requests.push({ path, options });
      if (flags.rawResponse) return flags.rawResponse();
      if (flags.network) throw new TypeError('Sensitive raw provider payload must never appear');
      const uid = options.headers.Authorization.includes('bob') ? 'bob' : 'alice';
      if (path === '/api/auth/sync') {
        if (flags.syncError) return Response.json({ code: flags.syncError, error: 'Sensitive raw SDK message' }, { status: 503 });
        return Response.json({ user: profiles[uid] });
      }
      if (flags.pendingHistory) return flags.pendingHistory;
      if (flags.historyError) return Response.json({ code: flags.historyError.code }, { status: flags.historyError.status });
      return Response.json({ orders: [{ id: 'VRN-' + uid, total: 2000, items: [] }] });
    },
  }, (state) => states.push(state));
  const stop = controller.start();
  return { controller, stop, flags, requests, states, emit: (next) => { user = next; observe?.(next); }, counts: () => ({ popupCalls, signOutCalls }) };
}

test('popup success explicitly verifies and replaces signed-out state even without an observer event', async () => {
  const h = harness();
  expect(h.controller.getState().phase).toBe('signed-out');
  await h.controller.signIn();
  const state = h.controller.getState();
  expect(state.phase).toBe('signed-in'); expect(state.profile).toEqual(profiles.alice);
  expect(state.orders.map((order) => order.id)).toEqual(['VRN-alice']);
  expect(h.requests.map((req) => req.path)).toEqual(['/api/auth/sync', '/api/orders']);
  for (const { options } of h.requests) {
    expect(options.headers).toEqual({ Authorization: 'Bearer test-alice-token' });
    expect(options.cache).toBe('no-store'); expect(options.body).toBeUndefined();
  }
  h.stop();
});

test('restored Firebase user is verified on reload without another popup; signing out clears profile and orders', async () => {
  const h = harness(alice); await tick();
  expect(h.controller.getState().phase).toBe('signed-in'); expect(h.counts().popupCalls).toBe(0);
  h.stop();
  const reloaded = harness(alice); await tick();
  expect(reloaded.controller.getState().profile.email).toBe('alice@example.test');
  expect(reloaded.counts().popupCalls).toBe(0);
  await reloaded.controller.logOut();
  expect(reloaded.controller.getState().phase).toBe('signed-out');
  expect(reloaded.controller.getState().profile).toBeNull(); expect(reloaded.controller.getState().orders).toEqual([]);
  expect(reloaded.counts().signOutCalls).toBe(1); reloaded.stop();
});

test.each([
  ['auth/unauthorized-domain', 'CUSTOMER_AUTH_UNAUTHORIZED_DOMAIN'],
  ['auth/operation-not-allowed', 'CUSTOMER_AUTH_PROVIDER_DISABLED'],
  ['auth/popup-blocked', 'CUSTOMER_AUTH_POPUP_BLOCKED'],
  ['auth/network-request-failed', 'CUSTOMER_AUTH_NETWORK'],
])('popup %s surfaces the real safe reason and never offers verification without a Firebase user', async (code, expected) => {
  const h = harness(); h.flags.popupError = { code, message: 'TOKEN_AND_SECRET_MUST_NOT_BE_RENDERED' };
  await h.controller.signIn();
  expect(h.controller.getState().error.code).toBe(expected);
  expect(h.controller.getState().canRetryVerification).toBe(false);
  expect(h.requests).toHaveLength(0);
  expect(JSON.stringify(h.controller.getState())).not.toContain('TOKEN_AND_SECRET');
  h.stop();
});

test.each([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
])('popup %s resets button without error (user cancelled)', async (code) => {
  const h = harness(); h.flags.popupError = { code, message: 'TOKEN_AND_SECRET_MUST_NOT_BE_RENDERED' };
  await h.controller.signIn();
  expect(h.controller.getState().error).toBeNull();
  expect(h.controller.getState().signingIn).toBe(false);
  expect(h.controller.getState().canRetryVerification).toBe(false);
  expect(h.requests).toHaveLength(0);
  h.stop();
});

test('signIn is safe without window and attaches a focus listener when window exists', async () => {
  expect(typeof window).toBe('undefined');
  const withoutWindow = harness();
  await withoutWindow.controller.signIn();
  expect(withoutWindow.controller.getState().phase).toBe('signed-in');
  withoutWindow.stop();

  const listeners = new Map();
  globalThis.window = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
  };
  try {
    const withWindow = harness();
    const pending = withWindow.controller.signIn();
    expect(typeof listeners.get('focus')).toBe('function');
    await pending;
    expect(listeners.has('focus')).toBe(false);
    withWindow.stop();
  } finally {
    delete globalThis.window;
  }
});

test.each(['CUSTOMER_AUTH_NOT_CONFIGURED', 'CUSTOMER_AUTH_INVALID_CREDENTIALS', 'CUSTOMER_AUTH_PROJECT_MISMATCH'])('sync %s stays signed out with a distinct retryable explanation', async (code) => {
  const h = harness(); h.flags.syncError = code;
  await h.controller.signIn();
  expect(h.controller.getState().phase).toBe('signed-out'); expect(h.controller.getState().profile).toBeNull();
  expect(h.controller.getState().error).toEqual(authIssue(code));
  expect(h.controller.getState().canRetryVerification).toBe(true);
  delete h.flags.syncError; await h.controller.retry();
  expect(h.controller.getState().phase).toBe('signed-in'); h.stop();
});

test('network failure is distinct from token rejection and arbitrary SDK messages are never exposed', async () => {
  const h = harness(); h.flags.network = true; await h.controller.signIn();
  expect(h.controller.getState().error.code).toBe('CUSTOMER_AUTH_NETWORK');
  expect(h.controller.getState().error.message).not.toContain('Sensitive');
  h.flags.network = false; h.flags.historyError = { status: 401, code: 'CUSTOMER_AUTH_TOKEN_REJECTED' };
  await h.controller.retry();
  expect(h.controller.getState().phase).toBe('signed-out'); expect(h.controller.getState().profile).toBeNull();
  expect(h.controller.getState().error.code).toBe('CUSTOMER_AUTH_TOKEN_REJECTED'); h.stop();
});

test('history outage preserves the verified account view and shows an error, never a guest/local history fallback', async () => {
  const h = harness(); h.flags.historyError = { status: 503, code: 'CUSTOMER_ORDERS_UNAVAILABLE' };
  await h.controller.signIn();
  expect(h.controller.getState().phase).toBe('signed-in'); expect(h.controller.getState().profile.uid).toBe('alice');
  expect(h.controller.getState().orders).toEqual([]); expect(h.controller.getState().ordersError.code).toBe('CUSTOMER_ORDERS_UNAVAILABLE');
  h.stop();
});

test('a stale response cannot repopulate orders after logout or a Google account switch', async () => {
  const h = harness();
  let resolveOld;
  h.flags.pendingHistory = new Promise((resolve) => { resolveOld = resolve; });
  const attempt = h.controller.signIn(); await tick();
  expect(h.controller.getState().profile.uid).toBe('alice');
  await h.controller.logOut();
  delete h.flags.pendingHistory; h.emit(bob); await tick();
  expect(h.controller.getState().profile.uid).toBe('bob');
  resolveOld(Response.json({ orders: [{ id: 'VRN-STALE-ALICE' }] })); await attempt;
  expect(h.controller.getState().orders.map((order) => order.id)).toEqual(['VRN-bob']); h.stop();
});

test('popup and observer verification share the same in-flight request', async () => {
  const h = harness(); h.flags.emitPopup = true;
  await h.controller.signIn();
  expect(h.requests.filter((request) => request.path === '/api/auth/sync')).toHaveLength(1);
  expect(h.controller.getState().phase).toBe('signed-in'); h.stop();
});

test('error mapping never renders unknown provider error text', () => {
  expect(mapCustomerAuthError({ code: 'auth/unknown', message: 'private credential and token' })).toEqual(authIssue('CUSTOMER_AUTH_GOOGLE_FAILED'));
});

// Render the actual account component from the verified controller snapshots.
let viewState;
mock.module('../src/hooks/use-customer-account.ts', () => ({ useCustomerAccount: () => ({
  ...viewState, canSignIn: true,
  loading: ['restoring', 'verifying'].includes(viewState.phase) || viewState.ordersLoading,
  errorCode: viewState.error?.code || null, error: viewState.error?.message || null,
  ordersError: viewState.ordersError?.message || null,
  signIn: () => {}, logOut: () => {}, retry: () => {},
}) }));
const { AccountView } = await import('../src/components/AccountView.tsx');
const render = () => renderToStaticMarkup(createElement(AccountView));
afterAll(() => mock.restore());

test('actual /account renders sign-in -> verified user page -> sign-in; restore never flashes the sign-in form', async () => {
  viewState = initialCustomerAccountState();
  expect(render()).toContain('Restoring your Google sign-in'); expect(render()).not.toContain('Continue with Google');
  const h = harness(); viewState = h.controller.getState();
  expect(render()).toContain('Sign in to Varnam'); expect(render()).toContain('Continue with Google');
  await h.controller.signIn(); viewState = h.controller.getState();
  const signedIn = render();
  expect(signedIn).toContain('Hello, Alice'); expect(signedIn).toContain('alice@example.test');
  expect(signedIn).toContain('VRN-alice'); expect(signedIn).toContain('Awaiting payment'); expect(signedIn).not.toContain('· Confirmed');
  expect(signedIn).not.toContain('Paid · Offline');
  expect(signedIn).toContain('My addresses'); expect(signedIn).toContain('Sign out');
  expect(signedIn).not.toContain('Sign in to Varnam'); expect(signedIn).not.toContain('Continue with Google');
  await h.controller.logOut(); viewState = h.controller.getState();
  expect(render()).toContain('Continue with Google'); expect(render()).not.toContain('alice@example.test');
  h.stop();
});

test('account order rows show customer-facing status plus a payment label', () => {
  viewState = {
    ...initialCustomerAccountState(),
    phase: 'signed-in',
    profile: profiles.alice,
    orders: [
      { id: 'VRN-unpaid', total: 2000, status: 'Confirmed', items: [] },
      { id: 'VRN-offline', total: 3000, status: 'Confirmed', items: [], payment: { provider: 'offline', status: 'paid', method: 'UPI' } },
      { id: 'VRN-paid', total: 4000, status: 'Handloom Finishing', items: [], payment: { status: 'paid' } },
    ],
  };
  const html = render();
  expect(html).toContain('VRN-unpaid');
  expect(html).toContain('Awaiting payment');
  expect(html).not.toContain('· Awaiting payment');
  expect(html).toContain('VRN-offline');
  expect(html).toContain('Confirmed · Paid · Offline (UPI)');
  expect(html).toContain('VRN-paid');
  expect(html).toContain('Confirmed · Paid');
  expect(html).not.toContain('Handloom Finishing');
});

test.each([500, 502, 503, 200])('HTML/non-JSON HTTP %s shows a safe service explanation, never a JSON parser exception', async (status) => {
  const h = harness(); h.flags.rawResponse = () => new Response('<!DOCTYPE html><html>sensitive platform detail</html>', { status, headers: { 'Content-Type': 'text/html' } });
  await h.controller.signIn();
  expect(h.controller.getState().phase).toBe('signed-out');
  expect(h.controller.getState().error.code).toBe('CUSTOMER_AUTH_SERVICE_RESPONSE');
  expect(h.controller.getState().error.message).not.toContain('Unexpected token');
  expect(h.controller.getState().error.message).not.toContain('sensitive platform detail');
  h.stop();
});
