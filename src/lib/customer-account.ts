import type { CustomerOrder, UserProfile } from '@/types';
import {
  authIssue, CustomerAuthError, isCustomerAuthCode, mapCustomerAuthError,
  type CustomerAuthCode, type CustomerAuthIssue,
} from '@/lib/customer-auth-errors';

export interface CustomerAuthUser { uid: string; getIdToken(forceRefresh?: boolean): Promise<string> }
export interface CustomerAccountState {
  phase: 'restoring' | 'signed-out' | 'verifying' | 'signed-in';
  profile: UserProfile | null;
  orders: CustomerOrder[];
  ordersLoading: boolean;
  signingIn: boolean;
  error: CustomerAuthIssue | null;
  ordersError: CustomerAuthIssue | null;
  canRetryVerification: boolean;
}
export interface CustomerAccountDependencies {
  observe: (next: (user: CustomerAuthUser | null) => void, error: (error: unknown) => void) => () => void;
  currentUser: () => CustomerAuthUser | null;
  popup: () => Promise<{ user: CustomerAuthUser }>;
  signOut: () => Promise<void>;
  fetch: typeof fetch;
}
export const initialCustomerAccountState = (): CustomerAccountState => ({
  phase: 'restoring', profile: null, orders: [], ordersLoading: false,
  signingIn: false, error: null, ordersError: null, canRetryVerification: false,
});

// Both observer restoration and popup completion go through this same verified
// lifecycle. No browser profile/history can grant access.
export function createCustomerAccount(deps: CustomerAccountDependencies, notify: (state: CustomerAccountState) => void) {
  let state = initialCustomerAccountState();
  let active = false, revision = 0, action = 0;
  let pending: AbortController | null = null;
  let inFlight: { uid: string; promise: Promise<void> } | null = null;
  const publish = (patch: Partial<CustomerAccountState>) => {
    state = { ...state, ...patch };
    if (active) notify(state);
  };
  const failure = (code: CustomerAuthCode, status = 503) => new CustomerAuthError(authIssue(code).message, status, code);

  async function request(path: string, options: RequestInit) {
    let response: Response;
    try { response = await deps.fetch(path, options); }
    catch { throw failure('CUSTOMER_AUTH_NETWORK', 0); }
    const body = await response.json().catch(() => null);
    if (!body) throw failure('CUSTOMER_AUTH_SERVICE_RESPONSE', response.status >= 400 ? response.status : 503);
    if (!response.ok) {
      const fallback = response.status === 401 ? 'CUSTOMER_AUTH_TOKEN_REJECTED'
        : response.status === 403 ? 'CUSTOMER_AUTH_IDENTITY_REQUIRED'
        : 'CUSTOMER_AUTH_VERIFICATION_UNAVAILABLE';
      // Only allowlisted public messages are rendered, never arbitrary SDK/API
      // text, HTML error pages, full tokens or credential fields.
      throw failure(isCustomerAuthCode(body?.code) ? body.code : fallback, response.status);
    }
    return body;
  }

  function verify(user: CustomerAuthUser | null, forceRefresh = false): Promise<void> {
    if (!active) return Promise.resolve();
    if (!forceRefresh && user && state.phase === 'signed-in' && state.profile?.uid === user.uid) {
      return Promise.resolve();
    }
    if (user && inFlight?.uid === user.uid) return inFlight.promise;
    const current = ++revision;
    pending?.abort(); pending = new AbortController();
    const signal = pending.signal;
    const valid = () => active && current === revision && !signal.aborted;
    if (!user) {
      inFlight = null;
      publish({ phase: 'signed-out', profile: null, orders: [], ordersLoading: false, canRetryVerification: false });
      return Promise.resolve();
    }
    publish({ phase: 'verifying', profile: null, orders: [], ordersLoading: false, error: null, ordersError: null, canRetryVerification: true });
    const promise = (async () => {
      try {
        const token = await user.getIdToken(forceRefresh);
        if (!valid()) return;
        const options: RequestInit = { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal };
        const result = await request('/api/auth/sync', { ...options, method: 'POST' });
        if (!valid()) return;
        if (result.user?.uid !== user.uid || typeof result.user?.email !== 'string' || !result.user.email) {
          throw failure('CUSTOMER_AUTH_TOKEN_REJECTED', 401);
        }
        publish({ phase: 'signed-in', profile: result.user, error: null, ordersLoading: true });
        try {
          const history = await request('/api/orders', options);
          if (!valid()) return;
          if (!Array.isArray(history.orders)) throw failure('CUSTOMER_ORDERS_UNAVAILABLE');
          publish({ orders: history.orders, ordersError: null });
        } catch (error) {
          if (!valid()) return;
          const issue = mapCustomerAuthError(error);
          if (error instanceof CustomerAuthError && (error.status === 401 || error.status === 403)) {
            publish({ phase: 'signed-out', profile: null, orders: [], error: issue });
          } else publish({ orders: [], ordersError: issue });
        } finally { if (valid()) publish({ ordersLoading: false }); }
      } catch (error) {
        if (valid()) publish({ phase: 'signed-out', profile: null, orders: [], error: mapCustomerAuthError(error), ordersLoading: false });
      }
    })().finally(() => { if (inFlight?.promise === promise) inFlight = null; });
    inFlight = { uid: user.uid, promise };
    return promise;
  }

  const start = () => {
    active = true;
    const unsubscribe = deps.observe((user) => { void verify(user); }, (error) => {
      revision++; pending?.abort(); inFlight = null;
      publish({ phase: 'signed-out', profile: null, orders: [], ordersLoading: false, error: mapCustomerAuthError(error), canRetryVerification: Boolean(deps.currentUser()) });
    });
    return () => { active = false; revision++; action++; pending?.abort(); inFlight = null; unsubscribe(); };
  };
  const signIn = async () => {
    if (!active || state.signingIn) return;
    const attempt = ++action;
    publish({ signingIn: true, error: null, ordersError: null });
    try {
      // Invoke popup synchronously from the click; do not await persistence or a
      // network preflight first, which would lose the browser's user gesture.
      const result = await deps.popup();
      if (active && attempt === action) await verify(result.user);
    } catch (error) {
      if (active && attempt === action && !state.profile) {
        const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
        // Don't show error message for user-cancelled popups
        if (code === 'auth/popup-closed-by-user') {
          publish({ phase: 'signed-out', error: null, canRetryVerification: Boolean(deps.currentUser()) });
        } else {
          publish({ phase: 'signed-out', error: mapCustomerAuthError(error), canRetryVerification: Boolean(deps.currentUser()) });
        }
      }
    } finally { if (active && attempt === action) publish({ signingIn: false }); }
  };
  const logOut = async () => {
    action++; revision++; pending?.abort(); inFlight = null;
    publish({ phase: 'signed-out', profile: null, orders: [], error: null, ordersError: null, ordersLoading: false, signingIn: false, canRetryVerification: false });
    try { await deps.signOut(); }
    catch { publish({ error: authIssue('CUSTOMER_AUTH_SIGN_OUT_FAILED') }); }
  };
  return { start, signIn, logOut, retry: () => verify(deps.currentUser(), true), getState: () => state };
}
