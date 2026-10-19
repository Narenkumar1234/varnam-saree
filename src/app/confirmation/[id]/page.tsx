'use client';

import React, { use, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { money } from '@/data/products';
import { Icon } from '@/components/Icons';
import { OrderTotals } from '@/components/OrderTotals';
import { OrderLinePrice } from '@/components/OrderLinePrice';
import { CustomerPayment } from '@/components/CustomerPayment';
import { createWhatsAppOrderUrl } from '@/lib/whatsapp';

function ConfirmationContent({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const { getOrderById, getProductById, updateOrderPayment } = useStore();
  const order = getOrderById(orderId);
  const autoStartPayment = searchParams.get('pay') === 'online';

  if (!order) {
    return (
      <div className="empty">
        <h2>Order not found</h2>
        <p className="muted">Your order <strong>{orderId}</strong> may have been placed in another browser session.</p>
        <Link className="btn" href="/shop">
          Explore sarees
        </Link>
      </div>
    );
  }

  const whatsAppUrl = createWhatsAppOrderUrl(
    `Hello Varnam, I would like to confirm order ${order.id} (total ${money(order.total)}). Please help me arrange payment and delivery.`
  );

  const handlePaid = () => {
    updateOrderPayment(order.id, {
      provider: 'razorpay', status: 'paid',
      razorpayOrderId: '', amount: order.total * 100, currency: 'INR',
    });
  };

  return (
    <section className="confirmation">
      <span className="tick">
        <Icon name="check" />
      </span>
      <h1>A beautiful choice, {order.name}.</h1>
      <p>
        Your order <strong>{order.id}</strong> is confirmed.
      </p>

      {order.payment?.status === 'paid' ? (
        <p style={{ color: 'var(--success, #2e7d32)', fontWeight: 600 }} role="status">✓ Payment confirmed</p>
      ) : (
        <CustomerPayment
          orderId={order.id}
          total={order.total}
          customerName={order.name}
          payment={order.payment}
          autoStart={autoStartPayment && !order.payment}
          whatsAppUrl={whatsAppUrl}
          onPaid={handlePaid}
        />
      )}

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
          View tracking
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

export default function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="page-title"><h1>Loading…</h1></div>}>
      <ConfirmationContent orderId={resolvedParams.id} />
    </Suspense>
  );
}
