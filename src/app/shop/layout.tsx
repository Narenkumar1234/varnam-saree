import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Shop',
  description: "Explore Varnam's curated range of silk, cotton, and festive sarees.",
  alternates: {
    canonical: new URL('/shop', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Shop | Varnam',
    description: "Explore Varnam's curated range of silk, cotton, and festive sarees.",
    url: new URL('/shop', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
