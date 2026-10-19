'use client';

import { useEffect, useState } from 'react';
import { onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getCustomerFirebase } from '@/lib/firebase';
import { createCustomerAccount, initialCustomerAccountState, type CustomerAccountState } from '@/lib/customer-account';
import { mapCustomerAuthError } from '@/lib/customer-auth-errors';

let sharedAccount: ReturnType<typeof createCustomerAccount> | null = null;
let sharedState: CustomerAccountState = initialCustomerAccountState();
const listeners = new Set<(state: CustomerAccountState) => void>();

function getSharedAccount() {
  if (sharedAccount) return sharedAccount;
  if (typeof window === 'undefined') return null;
  try {
    const { auth, googleAuthProvider } = getCustomerFirebase();
    sharedAccount = createCustomerAccount({
      observe: (next, error) => onIdTokenChanged(auth, next, error),
      currentUser: () => auth.currentUser,
      popup: () => signInWithPopup(auth, googleAuthProvider),
      signOut: () => signOut(auth),
      fetch: (...args) => fetch(...args),
    }, (nextState) => {
      sharedState = nextState;
      listeners.forEach((listener) => listener(nextState));
    });
    sharedAccount.start();
    return sharedAccount;
  } catch (error) {
    sharedState = { ...initialCustomerAccountState(), phase: 'signed-out', error: mapCustomerAuthError(error) };
    return null;
  }
}

export function useCustomerAccount() {
  const [state, setState] = useState<CustomerAccountState>(() => sharedState);

  useEffect(() => {
    const account = getSharedAccount();
    if (!account) {
      setState(sharedState);
      return;
    }
    setState(account.getState());
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const account = sharedAccount;

  return {
    ...state,
    canSignIn: Boolean(account),
    loading: state.phase === 'restoring' || state.phase === 'verifying' || state.ordersLoading,
    errorCode: state.error?.code || null,
    error: state.error?.message || null,
    ordersError: state.ordersError?.message || null,
    signIn: () => getSharedAccount()?.signIn(),
    logOut: () => getSharedAccount()?.logOut(),
    retry: () => getSharedAccount()?.retry(),
  };
}
