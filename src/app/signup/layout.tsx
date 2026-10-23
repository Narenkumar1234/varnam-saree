import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create an account with Varnam to save your favourite sarees and addresses.',
  alternates: {
    canonical: new URL('/signup', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Sign Up | Varnam',
    description: 'Create an account with Varnam to save your favourite sarees and addresses.',
    url: new URL('/signup', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
