import type { Metadata } from 'next';
import { DeliveryPolicy } from '@/components/DeliveryPolicy';
import React from 'react';
import Link from 'next/link';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Shipping & Returns',
  description: 'Details on delivery timelines, shipping charges, and returns for Varnam orders.',
  alternates: {
    canonical: new URL('/shipping', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Shipping & Returns | Varnam',
    description: 'Details on delivery timelines, shipping charges, and returns for Varnam orders.',
    url: new URL('/shipping', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function ShippingPage() {
  return (
    <>
      <div className="page-title">
        <h1>Shipping & returns</h1>
      </div>

      <article className="prose">
        <h2>Delivery, with care</h2>
        <p>
          Standard delivery within India is estimated at 5–7 business days. We offer{' '}
          <DeliveryPolicy includeFee embedded />.
        </p>

        <h2>Returns & exchanges</h2>
        <p>
          Please contact Varnam within 7 days of delivery to discuss a return or exchange. Sarees
          must be unworn and unwashed, with tags and original packaging. Contact us to confirm
          return shipping costs and refund timelines.
        </p>

        <h2>Need a hand?</h2>
        <p>
          <Link className="text-link" href="/contact">
            Contact Varnam
          </Link>{' '}
          for questions about your order, delivery, returns, or exchanges.
        </p>
      </article>
    </>
  );
}
