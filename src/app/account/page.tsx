import type { Metadata } from 'next';
import { AccountView } from '@/components/AccountView';
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

export default function AccountPage() {
  return <AccountView initialSignUp={false} />;
}
