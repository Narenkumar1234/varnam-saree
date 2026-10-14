'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/context/store-context';
import { money } from '@/data/products';

export default function OrdersPage() {
  const { orders } = useStore();

  return (
    <>
      <div className="page-title">
        <h1>Your orders</h1>
        <p>Your Varnam stories, all in one place.</p>
      </div>

      <section className="prose">
        {orders.length > 0 ? (
          orders.map((o) => (
            <div key={o.id} className="order-card">
              <h3>
                {o.id}{' '}
                <span className="muted" style={{ fontSize: '11px' }}>
                  · Demo order
                </span>
              </h3>
              <p>
                {o.date} · {o.items.reduce((s, x) => s + x.qty, 0)} item(s) · {money(o.total)}
              </p>
              <Link className="text-link" href={`/track?order=${o.id}`}>
                View order & tracking
              </Link>
            </div>
          ))
        ) : (
          <div className="empty">
            <h2>Your stories start here</h2>
            <p className="muted">You have no demo orders yet.</p>
            <Link className="btn" href="/shop">
              Explore sarees
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
