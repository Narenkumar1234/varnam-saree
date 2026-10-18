import React from 'react';
import Link from 'next/link';

export default function ShippingPage() {
  return (
    <>
      <div className="page-title">
        <h1>Shipping & returns</h1>
      </div>

      <article className="prose">
        <p className="demo-note">
          Proposed policy for the store preview. Confirm these terms before launching real sales.
        </p>

        <h2>Delivery, with care</h2>
        <p>
          Standard delivery within India is estimated at 5–7 business days. The demo offers
          free delivery on orders above ₹2,999; otherwise, a ₹150 delivery charge applies.
        </p>

        <h2>Returns & exchanges</h2>
        <p>
          Proposed return window: 7 days from delivery for unworn, unwashed sarees with tags and
          original packaging. Custom finishing would be excluded except for defects. The business
          should confirm return shipping costs and refund timelines.
        </p>

        <h2>Need a hand?</h2>
        <p>
          <Link className="text-link" href="/contact">
            Contact Varnam
          </Link>{' '}
          for questions about your order. Demo orders do not create shipments.
        </p>
      </article>
    </>
  );
}
