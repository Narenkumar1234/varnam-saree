import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Journal',
  description: 'Stories of weave traditions, styling rituals, and the everyday joy of six yards.',
  alternates: {
    canonical: new URL('/journal', getSiteUrl()).href,
  },
  openGraph: {
    title: 'Journal | Varnam',
    description: 'Stories of weave traditions, styling rituals, and the everyday joy of six yards.',
    url: new URL('/journal', getSiteUrl()).href,
    siteName: 'Varnam',
    type: 'website',
  },
};

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
