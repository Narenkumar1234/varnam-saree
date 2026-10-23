import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Contact',
  description: "Get in touch with Varnam for styling guidance, order assistance, or questions about our weaves.",
  alternates: {
    canonical: new URL('/contact', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Contact | Varnam',
    description: "Get in touch with Varnam for styling guidance, order assistance, or questions about our weaves.",
    url: new URL('/contact', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
