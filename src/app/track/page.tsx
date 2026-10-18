'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { money } from '@/data/products';
import { OrderSavings } from '@/components/OrderTotals';
import { loadTrackedOrder, type TrackedOrder } from '@/lib/order-lookup';

function TrackContent() {
  const searchParams = useSearchParams();
  const { getOrderById } = useStore();
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
    if (localOrder) { setLookup({ id: searchedId, status: 'found', order: localOrder }); return; }
    const controller = new AbortController();
    setLookup({ id: searchedId, status: 'loading' });
    loadTrackedOrder(searchedId, controller.signal)
      .then((order) => {
        if (!controller.signal.aborted) setLookup(order ? { id: searchedId, status: 'found', order } : { id: searchedId, status: 'not-found' });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookup({ id: searchedId, status: 'error' });
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
              <div>
                <h2 style={{ fontSize: '24px' }}>{order.id}</h2>
                <p className="muted">
                  Order placed on{' '}
                  {order.date ||
                    new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                </p>

                <div className="track-step current" style={{ margin: '20px 0' }}>
                  <div className="step-title">1. Order confirmed</div>
                  <small>Your saree was chosen and hand-inspected in our workshop.</small>
                </div>
                <div className="track-step">
                  <div className="step-title">2. Handloom finishing</div>
                  <small>Tassels, fall, and edging being prepared with care.</small>
                </div>
                <div className="track-step">
                  <div className="step-title">3. Dispatched</div>
                  <small>Complimentary insured shipping across India.</small>
                </div>

                <div style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '15px' }}>
                  <strong>Total: {money(order.total)}</strong>
                  <OrderSavings pricing={order.pricing} />
                </div>
              </div>
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
