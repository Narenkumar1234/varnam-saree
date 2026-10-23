import type { Metadata } from 'next';
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

export default function CollectionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
