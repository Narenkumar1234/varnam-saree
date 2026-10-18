import type { MetadataRoute } from 'next';
import { articles } from '@/data/products';
import { getCatalogue } from '@/lib/catalogue-server';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products } = await getCatalogue();
  const paths = ['/', '/shop', '/collections', '/story', '/journal', '/contact', '/faq', '/shipping', '/privacy', '/terms',
    ...articles.map((article) => `/journal/${article.id}`),
    ...products.map((product) => `/product/${product.id}`),
  ];
  return paths.map((path) => ({ url: new URL(path, getSiteUrl()).href }));
}
