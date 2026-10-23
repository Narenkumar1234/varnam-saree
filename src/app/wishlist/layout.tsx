import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Wishlist',
  description: 'Keep your favourite sarees close. View and manage your saved wishlist at Varnam.',
  alternates: {
    canonical: new URL('/wishlist', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Wishlist | Varnam',
    description: 'Keep your favourite sarees close. View and manage your saved wishlist at Varnam.',
    url: new URL('/wishlist', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
