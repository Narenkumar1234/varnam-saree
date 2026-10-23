import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions governing the use of the Varnam website and services.',
  alternates: {
    canonical: new URL('/terms', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Terms of Service | Varnam',
    description: 'Terms and conditions governing the use of the Varnam website and services.',
    url: new URL('/terms', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
