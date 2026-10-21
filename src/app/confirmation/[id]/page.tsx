'use client';

import React, { use, Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { money } from '@/data/products';
import { Icon } from '@/components/Icons';
import { OrderTotals } from '@/components/OrderTotals';
import { OrderLinePrice } from '@/components/OrderLinePrice';
import { CustomerPayment } from '@/components/CustomerPayment';
import { isPaidPayment } from '@/lib/order-status';
import { createSavedOrderWhatsAppMessage, createWhatsAppOrderUrl } from '@/lib/whatsapp';
import { ProductThumb } from '@/components/ProductThumb';
import { resolveOrderLineImage } from '@/lib/product-gallery';
import { capitalizeColour } from '@/lib/colour';

function ConfirmationContent({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const { getOrderById, getProductById, updateOrderPayment } = useStore();
  const order = getOrderById(orderId);
  const autoStartPayment = searchParams.get('pay') === 'online';
  const viaWhatsApp = searchParams.get('via') === 'whatsapp';
  const openWhatsAppHere = viaWhatsApp && searchParams.get('open') === '1';
  const orderWhatsAppUrl = order ? createWhatsAppOrderUrl(createSavedOrderWhatsAppMessage({
    id: order.id, status: 'Payment pending', total: order.total, items: order.items, pricing: order.pricing, customerName: order.name,
  }, [], typeof window === 'undefined' ? '' : window.location.origin)) : null;

  // WhatsApp checkout when the new tab was blocked: this entry becomes the plain
  // confirmation URL, then this tab goes to WhatsApp, so Back lands here.
  const handedOff = useRef(false);
  useEffect(() => {
    if (!openWhatsAppHere || !orderWhatsAppUrl || handedOff.current) return;
    handedOff.current = true;
    window.history.replaceState(null, '', `/confirmation/${encodeURIComponent(orderId)}?via=whatsapp`);
    window.location.assign(orderWhatsAppUrl);
  }, [openWhatsAppHere, orderWhatsAppUrl, orderId]);

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
      {isPaidPayment(order.payment) ? (
        <p>
          Your order <strong>{order.id}</strong> is confirmed.
        </p>
      ) : (
        <p>Order placed — awaiting payment</p>
      )}

      {viaWhatsApp && !isPaidPayment(order.payment) && orderWhatsAppUrl && (
        <p className="muted" role="status" style={{ marginTop: '8px' }}>
          We&apos;ve opened WhatsApp with your order ID so we can confirm payment and delivery.{' '}
          <a className="text-link" href={orderWhatsAppUrl} target="_blank" rel="noopener noreferrer">WhatsApp didn&apos;t open? Continue on WhatsApp</a>
        </p>
      )}

      {isPaidPayment(order.payment) ? (
        <p style={{ color: 'var(--success, #2e7d32)', fontWeight: 600 }} role="status">✓ Payment confirmed</p>
      ) : (
        <CustomerPayment
          orderId={order.id}
          total={order.total}
          customerName={order.name}
          payment={order.payment}
          idleLabel={order.payment ? 'Retry payment' : 'Pay now'}
          autoStart={autoStartPayment && !order.payment}
          whatsAppUrl={whatsAppUrl}
          onPaid={handlePaid}
        />
      )}

      <div className="order-card" style={{ maxWidth: '480px', margin: '30px auto', textAlign: 'left' }}>
        <div className="order-summary-items" style={{ marginBottom: '16px' }}>
          {order.items.map((x, idx) => {
            const p = getProductById(x.id);
            const itemName = x.name || p?.name || 'Saree';
            const lineImage = resolveOrderLineImage(x, p);
            const variantName = x.variant || x.colour;
            return (
              <div key={x.id ? `${x.id}-${idx}` : idx} className="order-summary-item">
                <div className="order-summary-thumb">
                  <ProductThumb
                    src={lineImage}
                    alt={itemName}
                    sizes="64px"
                  />
                </div>
                <div className="order-summary-details">
                  <span className="order-summary-name">
                    {itemName} × {x.qty}
                  </span>
                  {variantName && (
                    <span className="order-summary-meta muted">
                      {capitalizeColour(variantName)}
                    </span>
                  )}
                </div>
                <OrderLinePrice item={x} />
              </div>
            );
          })}
        </div>
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
