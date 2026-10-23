import type { Metadata } from 'next';
import React from 'react';
import { faqs } from '@/data/products';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about Varnam sarees, weaves, orders, and care.',
  alternates: {
    canonical: new URL('/faq', getSiteUrl()).href,
  },
  openGraph: {
    title: 'FAQ | Varnam',
    description: 'Answers to common questions about Varnam sarees, weaves, orders, and care.',
    url: new URL('/faq', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function FaqPage() {
  return (
    <>
      <div className="page-title">
        <h1>A little help</h1>
        <p>Answers to the questions on your mind.</p>
      </div>

      <article className="prose">
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </article>
    </>
  );
}
