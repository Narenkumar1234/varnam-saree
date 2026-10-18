'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleAuthProvider } from '@/lib/firebase';
import type { CustomerOrder, UserProfile } from '@/types';

// Account data is fetched only after server verification. Never restore a
// profile or history from localStorage, or fall back to guest order snapshots.
export function useCustomerAccount() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const revision = useRef(0);
  const pending = useRef<AbortController | null>(null);

  const loadAccount = useCallback(async (user: User | null) => {
    const current = ++revision.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const active = () => current === revision.current && !controller.signal.aborted;
    setProfile(null); setOrders([]); setError(null); setOrdersError(null);
    setLoading(Boolean(user));
    if (!user) return;
    try {
      const token = await user.getIdToken();
      if (!active()) return;
      const options = { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' as const, signal: controller.signal };
      const sync = await fetch('/api/auth/sync', { ...options, method: 'POST' });
      const data = await sync.json();
      if (!sync.ok || !data.user?.email || data.user.uid !== user.uid) {
        throw new Error(data.error || 'Your sign-in could not be verified. Please sign in with Google again.');
      }
      if (!active()) return;
      setProfile(data.user);
      try {
        const response = await fetch('/api/orders', options);
        const history = await response.json();
        if (!active()) return;
        if (response.status === 401 || response.status === 403) {
          setProfile(null);
          throw new Error(history.error || 'Please sign in with Google again to view your orders.');
        }
        if (!response.ok || !Array.isArray(history.orders)) {
          throw new Error(history.error || 'Your orders could not be loaded. Check your connection and retry.');
        }
        setOrders(history.orders);
      } catch (failure) {
        if (active()) setOrdersError(failure instanceof Error ? failure.message : 'Your orders could not be loaded. Please retry.');
      }
    } catch (failure) {
      if (active()) { setProfile(null); setOrders([]); setError(failure instanceof Error ? failure.message : 'Your sign-in could not be verified. Please sign in with Google again.'); }
    } finally {
      if (active()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (user) => { void loadAccount(user); }, () => {
      revision.current++; pending.current?.abort();
      setProfile(null); setOrders([]); setLoading(false);
      setError('Your sign-in could not be verified. Please sign in with Google again.');
    });
    return () => { revision.current++; pending.current?.abort(); unsubscribe(); };
  }, [loadAccount]);

  const signIn = async () => {
    setSigningIn(true); setError(null);
    try {
      // The token observer performs server verification before showing data.
      await signInWithPopup(auth, googleAuthProvider);
    } catch {
      setError('Google sign-in could not be completed. Please try again.');
    } finally { setSigningIn(false); }
  };

  const logOut = async () => {
    revision.current++; pending.current?.abort();
    setProfile(null); setOrders([]); setError(null); setOrdersError(null); setLoading(false);
    try { await signOut(auth); }
    catch { setError('Sign-out could not be completed. Please retry.'); }
  };

  return { profile, orders, loading, signingIn, error, ordersError, signIn, logOut, retry: () => loadAccount(auth.currentUser) };
}
