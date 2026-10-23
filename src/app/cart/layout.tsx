import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'View and manage the sarees in your Varnam shopping bag.',
  alternates: {
    canonical: new URL('/cart', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Cart | Varnam',
    description: 'View and manage the sarees in your Varnam shopping bag.',
    url: new URL('/cart', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
