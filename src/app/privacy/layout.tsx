import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Understand how Varnam manages your saved information and protects your privacy.',
  alternates: {
    canonical: new URL('/privacy', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Privacy Policy | Varnam',
    description: 'Understand how Varnam manages your saved information and protects your privacy.',
    url: new URL('/privacy', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
