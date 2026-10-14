'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/context/store-context';

function TrackContent() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get('order') || '';

  const [orderQuery, setOrderQuery] = useState(initialOrderId);
  const [searchedId, setSearchedId] = useState(initialOrderId);
  const { getOrderById } = useStore();

  useEffect(() => {
    const o = searchParams.get('order');
    if (o) {
      setOrderQuery(o);
      setSearchedId(o);
    }
  }, [searchParams]);

  const order = searchedId ? getOrderById(searchedId) : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedId(orderQuery.trim());
  };

  return (
    <>
      <div className="page-title">
        <h1>Follow your saree’s journey</h1>
        <p>Preview tracking for a demo order placed on this browser.</p>
      </div>

      <div className="auth">
        <form onSubmit={handleSubmit}>
          <label>
            Order number
            <input
              name="order"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              placeholder="e.g. VRN1234567"
              required
            />
          </label>
          <button className="btn" type="submit">
            Find demo order
          </button>
        </form>

        <div id="trackResult" style={{ marginTop: '30px' }}>
          {searchedId && (
            <>
              {order ? (
                <div>
                  <h2 style={{ fontSize: '24px' }}>{order.id}</h2>
                  <p className="demo-note">Demo status only. No real shipment exists.</p>

                  <div className="status-step">
                    <h3>Order placed</h3>
                    <p>{order.date} · Your demo order is confirmed.</p>
                  </div>
                  <div className="status-step">
                    <h3>Preparing your saree</h3>
                    <p>Preview of the next fulfilment step.</p>
                  </div>
                  <div className="status-step">
                    <h3>On its way</h3>
                    <p>Shipping updates will appear here when connected.</p>
                  </div>

                  <p style={{ marginTop: '20px' }}>
                    <Link className="text-link" href={`/confirmation/${order.id}`}>
                      View order details
                    </Link>
                  </p>
                </div>
              ) : (
                <p>
                  No demo order found for <strong>{searchedId}</strong>. Check your order number and
                  use the browser where you placed it.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="section"><p>Loading tracking...</p></div>}>
      <TrackContent />
    </Suspense>
  );
}
