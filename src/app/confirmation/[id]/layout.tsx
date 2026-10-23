import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Order Confirmation',
  description: 'Thank you for your order at Varnam. View your order receipt and tracking status.',
  alternates: {
    canonical: new URL('/confirmation', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Order Confirmation | Varnam',
    description: 'Thank you for your order at Varnam. View your order receipt and tracking status.',
    url: new URL('/confirmation', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function ConfirmationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
