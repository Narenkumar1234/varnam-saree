import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

/** Per-route metadata; the root layout's title template adds " | Varnam". */
export function pageMetadata(path: string, title: string, description: string): Metadata {
  const url = new URL(path, getSiteUrl()).href;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Varnam`, description, url, siteName: 'Varnam', type: 'website' },
  };
}
