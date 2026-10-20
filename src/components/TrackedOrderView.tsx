'use client';

import { CustomerPayment } from '@/components/CustomerPayment';
import { OrderSavings } from '@/components/OrderTotals';
import { money } from '@/data/products';
import type { TrackedOrder } from '@/lib/order-lookup';
import {
  accountOrderStatusLine,
  isCancelledOrderStatus,
  paymentDisplayStatus,
  trackingConfirmStepComplete,
  trackingDeliveredStepComplete,
} from '@/lib/order-status';
import { createWhatsAppOrderUrl } from '@/lib/whatsapp';

interface Props {
  order: TrackedOrder & { name?: string };
  onPaid?: () => void;
}

export function TrackedOrderView({ order, onPaid }: Props) {
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
        <small>Complimentary insured shipping across India.</small>
      </div>

      <div style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '15px' }}>
        <strong>Total: {money(order.total)}</strong>
        <OrderSavings pricing={order.pricing} />
      </div>
    </div>
  );
}
