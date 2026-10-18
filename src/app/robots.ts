import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*', allow: '/',
      disallow: ['/api/', '/studio-desk', '/cart', '/checkout', '/confirmation/', '/track', '/account', '/addresses', '/orders', '/wishlist', '/login', '/signup'],
    },
    sitemap: new URL('/sitemap.xml', getSiteUrl()).href,
    host: getSiteUrl().origin,
  };
}
