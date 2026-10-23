import type { Metadata } from 'next';
import React from 'react';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions governing the use of the Varnam website and services.',
  alternates: {
    canonical: new URL('/terms', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Terms of Service | Varnam',
    description: 'Terms and conditions governing the use of the Varnam website and services.',
    url: new URL('/terms', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function TermsPage() {
  return (
    <>
      <div className="page-title">
        <h1>Terms of use</h1>
      </div>

      <article className="prose">
        <h2>A store concept</h2>
        <p>
          Varnam is a demonstration storefront. Prices, product descriptions, images and policies
          are illustrative. No commercial sale takes place when a demo order is submitted.
        </p>

        <h2>Images & catalogue</h2>
        <p>
          Campaign and fabric images are AI generated. Similar colour variants share illustrative
          photography. Real product photos and verified specifications should replace these before
          launch.
        </p>

        <h2>Orders & payment</h2>
        <p>
          No payment details are requested or processed. Confirmation screens and tracking statuses
          refer only to sample orders created on your browser.
        </p>
      </article>
    </>
  );
}
