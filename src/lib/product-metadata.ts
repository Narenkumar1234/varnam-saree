import type { Metadata } from 'next';
import type { Product } from '@/types';
import { getSiteUrl } from '@/lib/site-url';

export function productMetadata(product: Product): Metadata {
  const title = `${product.name} | Varnam`;
  const description = product.description?.trim() || `Discover ${product.name}, a ${product.colour.toLowerCase()} ${product.type} saree from Varnam's ${product.collection} collection.`;
  const url = new URL(`/product/${product.id}`, getSiteUrl()).href;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, siteName: 'Varnam', type: 'website',
      images: [{ url: product.image, alt: product.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [product.image] },
  };
}
