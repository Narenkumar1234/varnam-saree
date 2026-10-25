import React from 'react';
import Link from 'next/link';
import { BusinessContact } from '@/components/BusinessContact';
import { BUSINESS } from '@/lib/business';

export default function RefundPage() {
  return (
    <>
      <div className="page-title">
        <h1>Refund &amp; replacement policy</h1>
        <p>Replacements, refunds and cancellations for {BUSINESS.name} orders.</p>
      </div>

      <article className="prose">
        <h2>No returns</h2>
        <p>
          {BUSINESS.name} does not accept returns or exchanges for change of mind, colour preference or
          fit. Please check the product photos and description carefully before ordering.
        </p>

        <h2>Replacement for damaged, defective or wrong items</h2>
        <p>
          If your saree arrives damaged, defective, or is not the item you ordered, we will replace it.
          Please request a replacement within {BUSINESS.replacementWindowDays} days of delivery by WhatsApp on {BUSINESS.phoneDisplay} or
          by email at <a className="text-link" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>,
          with your order number and the unboxing video. Requests made more than{' '}
          {BUSINESS.replacementWindowDays} days after delivery cannot be accepted.
        </p>

        <h2>Unboxing video required</h2>
        <p>
          A replacement is possible only with a clear, unedited video of the parcel being opened, recorded
          from the sealed package onwards, showing the damage, defect or wrong item. Requests without an
          unboxing video cannot be accepted.
        </p>

        <h2>How a replacement works</h2>
        <p>
          Once we review your video and confirm the issue, we will arrange a replacement and let you know
          the next steps.
        </p>

        <h2>Refunds</h2>
        <p>
          Refunds are issued only when an order is cancelled or a paid order cannot be fulfilled. Approved
          refunds are made to the original payment method through Razorpay. The time taken to reach your
          account depends on your bank or UPI provider.
        </p>

        <h2>Cancellations</h2>
        {/* TODO(athai): confirm cancellation rules (e.g. allowed only before dispatch). */}
        <p>
          If you need to cancel an order, please contact us as soon as possible, before it is dispatched.
          If the order is cancelled, the full amount is refunded to your original payment method.
        </p>

        <p>
          For dispatch and delivery timelines, see our{' '}
          <Link className="text-link" href="/shipping">Shipping &amp; delivery policy</Link>.
        </p>

        <BusinessContact />
      </article>
    </>
  );
}
