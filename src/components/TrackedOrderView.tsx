'use client';

import { CustomerPayment } from '@/components/CustomerPayment';
import { OrderSavings } from '@/components/OrderTotals';
import { money } from '@/data/products';
import type { TrackedOrder } from '@/lib/order-lookup';
import {
  customerFacingOrderStatus,
  customerPaymentLabel,
  paymentDisplayStatus,
  trackingConfirmStepComplete,
} from '@/lib/order-status';
import { createWhatsAppOrderUrl } from '@/lib/whatsapp';

interface Props {
  order: TrackedOrder & { name?: string };
  onPaid?: () => void;
}

export function TrackedOrderView({ order, onPaid }: Props) {
  const payState = paymentDisplayStatus(order.payment);
  const facing = customerFacingOrderStatus(order.status, order.payment);
  const cancelled = facing.toLowerCase() === 'cancelled';
  const confirmDone = trackingConfirmStepComplete(order.status, order.payment);
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
        {cancelled ? facing : customerPaymentLabel(order.payment)}
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

      <div className={`track-step${confirmDone ? ' current' : ''}`} style={{ margin: '20px 0' }}>
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
  );
}
