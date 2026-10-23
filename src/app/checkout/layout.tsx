import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your purchase with secure checkout at Varnam.',
  alternates: {
    canonical: new URL('/checkout', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Checkout | Varnam',
    description: 'Complete your purchase with secure checkout at Varnam.',
    url: new URL('/checkout', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
