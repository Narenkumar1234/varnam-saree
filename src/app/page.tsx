import type { Metadata } from 'next';
import { HomePage } from '@/components/HomePage';
import { getPublicReviews } from '@/lib/reviews-server';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Varnam | Sarees, woven with stories',
  description: "Discover Varnam's collection of silk, cotton and occasion sarees. A thoughtfully designed saree shopping experience.",
  alternates: {
    canonical: new URL('/', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Varnam | Sarees, woven with stories',
    description: "Discover Varnam's collection of silk, cotton and occasion sarees. A thoughtfully designed saree shopping experience.",
    url: new URL('/', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
    images: [new URL('/assets/varnam-logo.png', getSiteUrl()).href],
  },
};

export default async function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Varnam',
    url: getSiteUrl().href,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage reviews={await getPublicReviews()} />
    </>
  );
}
