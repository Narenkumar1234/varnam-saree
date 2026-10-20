'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { TrackedOrderView } from '@/components/TrackedOrderView';
import { loadTrackedOrder, type TrackedOrder } from '@/lib/order-lookup';

function TrackContent() {
  const searchParams = useSearchParams();
  const { getOrderById, updateOrderPayment } = useStore();
  const [orderQuery, setOrderQuery] = useState('');
  const [searchedId, setSearchedId] = useState('');
  const [lookup, setLookup] = useState<{ id: string; status: 'loading' | 'found' | 'not-found' | 'error'; order?: TrackedOrder } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const localOrder = searchedId ? getOrderById(searchedId) : undefined;

  useEffect(() => {
    const o = searchParams.get('order');
    if (o) {
      setOrderQuery(o);
      setSearchedId(o);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!searchedId) { setLookup(null); return; }
    const controller = new AbortController();
    // Show a same-browser checkout snapshot immediately, then replace it with
    // GET /api/orders/[id] so Studio offline payments are reflected.
    if (localOrder) setLookup({ id: searchedId, status: 'found', order: localOrder });
    else setLookup({ id: searchedId, status: 'loading' });
    loadTrackedOrder(searchedId, controller.signal)
      .then((order) => {
        if (controller.signal.aborted) return;
        if (order) {
          setLookup({ id: searchedId, status: 'found', order });
          return;
        }
        if (!localOrder) setLookup({ id: searchedId, status: 'not-found' });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        if (!localOrder) setLookup({ id: searchedId, status: 'error' });
      });
    return () => controller.abort();
  }, [searchedId, localOrder, attempt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedId(orderQuery.trim());
    setAttempt((current) => current + 1);
  };

  const currentLookup = lookup?.id === searchedId ? lookup : null;
  const loading = Boolean(searchedId && !localOrder && (!currentLookup || currentLookup.status === 'loading'));
  const lookupError = currentLookup?.status === 'error';
  const order: TrackedOrder | undefined = localOrder || currentLookup?.order;

  return (
    <>
      <div className="page-title">
        <h1>Follow your saree’s journey</h1>
        <p>Preview tracking for an order placed on Varnam.</p>
      </div>

      <div className="auth">
        <form onSubmit={handleSubmit}>
          <label>
            Order number
            <input
              name="order"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              placeholder="e.g. VS-1042"
              required
            />
          </label>
          <button className="btn" type="submit">
            Find order
          </button>
        </form>

        <div id="trackResult" style={{ marginTop: '30px' }}>
          {loading ? (
            <p className="muted" style={{ textAlign: 'center' }}>
              Looking up your order…
            </p>
          ) : searchedId ? (
            lookupError ? (
              <div>
                <p role="alert">Could not load your order — check your connection and retry.</p>
                <button type="button" className="btn outline" onClick={() => setAttempt((current) => current + 1)}>Retry lookup</button>
              </div>
            ) : order ? (
              <TrackedOrderView
                order={{ ...order, name: localOrder?.name }}
                onPaid={localOrder ? () => updateOrderPayment(order.id, {
                  provider: 'razorpay', status: 'paid',
                  razorpayOrderId: '', amount: order.total * 100, currency: 'INR',
                }) : undefined}
              />
            ) : (
              <div className="empty" style={{ padding: '20px 0' }}>
                <p>No order found with number “{searchedId}”.</p>
                <small className="muted">Check the number on your confirmation receipt.</small>
              </div>
            )
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="page-title"><h1>Loading tracking…</h1></div>}>
      <TrackContent />
    </Suspense>
  );
}
