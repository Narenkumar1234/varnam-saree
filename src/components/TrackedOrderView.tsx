'use client';

import React, { useContext } from 'react';
import { CustomerPayment } from '@/components/CustomerPayment';
import { OrderSavings } from '@/components/OrderTotals';
import { money, fallbackProducts } from '@/data/products';
import type { TrackedOrder } from '@/lib/order-lookup';
import {
  accountOrderStatusLine,
  isCancelledOrderStatus,
  paymentDisplayStatus,
  trackingConfirmStepComplete,
  trackingDeliveredStepComplete,
  trackingDeliveryCopy,
} from '@/lib/order-status';
import { createWhatsAppOrderUrl } from '@/lib/whatsapp';
import { StoreContext } from '@/context/store-context';
import { ProductThumb } from '@/components/ProductThumb';
import { resolveOrderLineImage } from '@/lib/product-gallery';
import { capitalizeColour } from '@/lib/colour';
import { OrderLinePrice } from '@/components/OrderLinePrice';

interface Props {
  order: TrackedOrder & { name?: string };
  onPaid?: () => void;
}

export function TrackedOrderView({ order, onPaid }: Props) {
  const store = useContext(StoreContext);
  const getProductById = store?.getProductById ?? ((id: number | string) => fallbackProducts.find((p) => p.id === Number(id)));
  const payState = paymentDisplayStatus(order.payment);
  const facing = accountOrderStatusLine(order.status, order.payment);
  const cancelled = isCancelledOrderStatus(order.status);
  const confirmDone = trackingConfirmStepComplete(order.status, order.payment);
  const deliveredDone = trackingDeliveredStepComplete(order.status, order.payment);
  const whatsAppUrl = createWhatsAppOrderUrl(
    `Hello Varnam, I need help completing payment for order ${order.id} (${money(order.total)}). Please help me arrange payment and delivery.`
  );

  return (
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

      <p role="status" className={`track-payment-banner is-${cancelled ? 'cancelled' : payState}`}>
        {facing}
      </p>

      {!cancelled && payState !== 'paid' && (
        <CustomerPayment
          orderId={order.id}
          total={order.total}
          customerName={order.name || ''}
          payment={order.payment}
          idleLabel={order.payment ? 'Retry payment' : 'Pay now'}
          whatsAppUrl={whatsAppUrl}
          onPaid={onPaid}
        />
      )}

      <div className="track-step" style={{ margin: '20px 0' }}>
        <div className="step-title">1. Order placed</div>
        <small>Your saree was chosen and hand-inspected in our workshop.</small>
      </div>
      <div className={`track-step${confirmDone ? ' current' : ''}`}>
        <div className="step-title">2. Confirmed</div>
        <small>Payment received. We are preparing your saree with care.</small>
      </div>
      <div className={`track-step${deliveredDone ? ' current' : ''}`}>
        <div className="step-title">3. Delivered</div>
        <small>{trackingDeliveryCopy(order.pricing)}</small>
      </div>

      {order.items && order.items.length > 0 && (
        <div className="order-summary-items" style={{ margin: '24px 0 16px' }}>
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
      )}

      <div style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '15px' }}>
        <strong>Total: {money(order.total)}</strong>
        <OrderSavings pricing={order.pricing} />
      </div>
    </div>
  );
}
