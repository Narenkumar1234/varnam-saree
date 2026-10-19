'use client';

import { useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getCustomerFirebase } from '@/lib/firebase';
import { createCustomerAccount, initialCustomerAccountState } from '@/lib/customer-account';
import { mapCustomerAuthError } from '@/lib/customer-auth-errors';

export function useCustomerAccount() {
  const [state, setState] = useState(initialCustomerAccountState);
  const controller = useRef<ReturnType<typeof createCustomerAccount> | null>(null);
  useEffect(() => {
    try {
      const { auth, googleAuthProvider } = getCustomerFirebase();
      const account = createCustomerAccount({
        observe: (next, error) => onIdTokenChanged(auth, next, error),
        currentUser: () => auth.currentUser,
        popup: () => signInWithPopup(auth, googleAuthProvider),
        signOut: () => signOut(auth),
        fetch: (...args) => fetch(...args),
      }, setState);
      controller.current = account;
      const stop = account.start();
      return () => { controller.current = null; stop(); };
    } catch (error) {
      setState({ ...initialCustomerAccountState(), phase: 'signed-out', error: mapCustomerAuthError(error) });
    }
  }, []);
  return {
    ...state,
    canSignIn: Boolean(controller.current),
    loading: state.phase === 'restoring' || state.phase === 'verifying' || state.ordersLoading,
    errorCode: state.error?.code || null,
    error: state.error?.message || null,
    ordersError: state.ordersError?.message || null,
    signIn: () => controller.current?.signIn(),
    logOut: () => controller.current?.logOut(),
    retry: () => controller.current?.retry(),
  };
}
