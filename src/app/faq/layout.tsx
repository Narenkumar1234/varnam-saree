import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about Varnam sarees, weaves, orders, and care.',
  alternates: {
    canonical: new URL('/faq', getSiteUrl()).href,
  },
  openGraph: {
    title: 'FAQ | Varnam',
    description: 'Answers to common questions about Varnam sarees, weaves, orders, and care.',
    url: new URL('/faq', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
