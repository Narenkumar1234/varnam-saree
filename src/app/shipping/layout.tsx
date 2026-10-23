import type { Metadata } from 'next';
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

export default function ShippingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
