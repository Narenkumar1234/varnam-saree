'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/store-context';
import { money } from '@/data/products';
import { Icon } from '@/components/Icons';
import { OrderTotals } from '@/components/OrderTotals';
import { OrderLinePrice } from '@/components/OrderLinePrice';

export default function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { getOrderById, getProductById } = useStore();
  const order = getOrderById(resolvedParams.id);

  if (!order) {
    return (
      <div className="empty">
        <h2>Order not found</h2>
        <p className="muted">You can create a demo order from your bag.</p>
        <Link className="btn" href="/shop">
          Explore sarees
        </Link>
      </div>
    );
  }

  return (
    <section className="confirmation">
      <span className="tick">
        <Icon name="check" />
      </span>
      <h1>A beautiful choice, {order.name}.</h1>
      <p>
        Your demo order <strong>{order.id}</strong> is confirmed.
      </p>
      <p className="muted">
        This sample order is saved on this browser. No payment, email, or shipment has been created.
      </p>

      <div className="order-card" style={{ maxWidth: '480px', margin: '30px auto', textAlign: 'left' }}>
        {order.items.map((x) => {
          const p = getProductById(x.id);
          return (
            <div key={x.id} className="summary-row">
              <span>
                {x.name || p?.name || 'Saree'} × {x.qty}
              </span>
              <OrderLinePrice item={x} />
            </div>
          );
        })}
        {order.pricing ? <OrderTotals pricing={order.pricing} /> : (
          <div className="summary-row total">
            <span>Order total</span>
            <strong>{money(order.total)}</strong>
          </div>
        )}
      </div>

      <div style={{ marginTop: '25px' }}>
        <Link className="btn" href={`/track?order=${order.id}`}>
          View demo tracking
        </Link>
      </div>
      <p style={{ marginTop: '20px' }}>
        <Link className="text-link" href="/shop">
          Keep exploring
        </Link>
      </p>
    </section>
  );
}
