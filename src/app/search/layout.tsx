import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search for sarees by colour, weave, or name across the Varnam collection.',
  alternates: {
    canonical: new URL('/search', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Search | Varnam',
    description: 'Search for sarees by colour, weave, or name across the Varnam collection.',
    url: new URL('/search', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
