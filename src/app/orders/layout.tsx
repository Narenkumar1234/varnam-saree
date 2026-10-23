import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'My Orders',
  description: 'View your order history and track the progress of your Varnam sarees.',
  alternates: {
    canonical: new URL('/orders', getSiteUrl()).href,
  },
  openGraph: {
    title: 'My Orders | Varnam',
    description: 'View your order history and track the progress of your Varnam sarees.',
    url: new URL('/orders', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
