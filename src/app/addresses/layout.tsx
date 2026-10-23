import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'My Addresses',
  description: 'Manage your saved delivery addresses for faster checkout at Varnam.',
  alternates: {
    canonical: new URL('/addresses', getSiteUrl()).href,
  },
  openGraph: {
    title: 'My Addresses | Varnam',
    description: 'Manage your saved delivery addresses for faster checkout at Varnam.',
    url: new URL('/addresses', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function AddressesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
