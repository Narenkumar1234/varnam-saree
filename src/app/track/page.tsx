'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { money } from '@/data/products';
import { Icon } from '@/components/Icons';

function TrackContent() {
  const searchParams = useSearchParams();
  const { getOrderById } = useStore();
  const [orderQuery, setOrderQuery] = useState('');
  const [searchedId, setSearchedId] = useState('');
  const [dbOrder, setDbOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const o = searchParams.get('order');
    if (o) {
      setOrderQuery(o);
      setSearchedId(o);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchedId) {
      const local = getOrderById(searchedId);
      if (local) {
        setDbOrder(local);
      } else {
        setLoading(true);
        fetch(`/api/orders/${encodeURIComponent(searchedId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.order) {
              setDbOrder(data.order);
            } else {
              setDbOrder(null);
            }
          })
          .catch((err) => {
            console.error('Failed to lookup order in DB:', err);
            setDbOrder(null);
          })
          .finally(() => setLoading(false));
      }
    }
  }, [searchedId, getOrderById]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedId(orderQuery.trim());
  };

  const order = dbOrder || (searchedId ? getOrderById(searchedId) : undefined);

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
            order ? (
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
