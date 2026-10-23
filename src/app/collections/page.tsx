import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collectionsData } from '@/data/products';
import { Icon } from '@/components/Icons';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Find the collection that speaks to you: Silk, Cotton, Festive, and everyday weaves.',
  alternates: {
    canonical: new URL('/collections', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Collections | Varnam',
    description: 'Find the collection that speaks to you: Silk, Cotton, Festive, and everyday weaves.',
    url: new URL('/collections', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function CollectionsPage() {
  return (
    <>
      <div className="page-title">
        <h1>A world of weaves</h1>
        <p>Find the collection that speaks to you.</p>
      </div>

      <section className="section">
        <div className="collections">
          {collectionsData.map((c) => (
            <Link
              key={c.name}
              className="collection"
              href={c.query ? `/shop?collection=${c.query}` : '/shop'}
            >
              <div className="collection-img-container">
                <Image
                  src={c.image}
                  alt={`${c.name} sarees`}
                  fill
                  sizes="(max-width: 700px) 50vw, 25vw"
                  className="collection-img"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="caption">
                <h3>{c.name === 'All' ? 'All sarees' : `${c.name} sarees`}</h3>
                <small>
                  {c.subtitle} <Icon name="arrow-up-right" />
                </small>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
