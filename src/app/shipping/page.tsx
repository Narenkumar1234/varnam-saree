import React from 'react';
import Link from 'next/link';
import { DeliveryPolicy } from '@/components/DeliveryPolicy';
import { BusinessContact } from '@/components/BusinessContact';
import { BUSINESS } from '@/lib/business';

export default function ShippingPage() {
  return (
    <>
      <div className="page-title">
        <h1>Shipping &amp; delivery policy</h1>
        <p>How and when your {BUSINESS.name} order reaches you.</p>
      </div>

      <article className="prose">
        <h2>Where we ship</h2>
        <p>We currently ship to addresses within India.</p>

        <h2>Dispatch and delivery time</h2>
        <p>
          Orders are dispatched within {BUSINESS.dispatchDays} business days of payment
          confirmation. Orders are usually delivered within {BUSINESS.deliveryWindow} business days,
          depending on your location and the courier partner.
        </p>

        <h2>Shipping charges</h2>
        {/* TODO(athai): confirm shipping charges; the line below follows the fee and free-delivery threshold set in Studio. */}
        <p>
          Shipping charges, if any, are shown at checkout before you pay. We offer{' '}
          <DeliveryPolicy includeFee embedded />.
        </p>

        <h2>Payment</h2>
        <p>
          Orders are paid online through Razorpay using UPI or debit cards.
          {/* TODO(athai): if cash on delivery is offered, describe it here. */}
        </p>

        <h2>Tracking your order</h2>
        <p>
          You can check your order status on our{' '}
          <Link className="text-link" href="/track">Track your order</Link> page, or message us on
          WhatsApp with your order number.
        </p>

        <h2>Delays and delivery issues</h2>
        <p>
          Occasionally, deliveries may be delayed by the courier, weather or other events beyond our
          control. Please make sure your address and phone number are correct, as we cannot be
          responsible for delays caused by incorrect details. If your parcel looks damaged or tampered
          with, record an unboxing video and contact us; see our{' '}
          <Link className="text-link" href="/refund">Refund &amp; replacement policy</Link>.
        </p>

        <BusinessContact />
      </article>
    </>
  );
}
