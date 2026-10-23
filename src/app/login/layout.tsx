import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Varnam account to securely access your orders and saved addresses.',
  alternates: {
    canonical: new URL('/login', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Sign In | Varnam',
    description: 'Sign in to your Varnam account to securely access your orders and saved addresses.',
    url: new URL('/login', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
