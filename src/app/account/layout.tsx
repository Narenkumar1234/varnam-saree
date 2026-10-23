import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'My Account',
  description: 'Manage your Varnam account, view saved addresses, and track previous orders.',
  alternates: {
    canonical: new URL('/account', getSiteUrl()).href,
  },
  openGraph: {
    title: 'My Account | Varnam',
    description: 'Manage your Varnam account, view saved addresses, and track previous orders.',
    url: new URL('/account', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
