import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Track Order',
  description: 'Track the delivery progress and status of your Varnam saree order.',
  alternates: {
    canonical: new URL('/track', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Track Order | Varnam',
    description: 'Track the delivery progress and status of your Varnam saree order.',
    url: new URL('/track', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
