import type { Metadata } from 'next';
import type { Product } from '@/types';
import { getProductCoverImage } from '@/lib/product-gallery';
import { getSiteUrl } from '@/lib/site-url';
import { withArticle } from '@/lib/article';

export function productMetadata(product: Product): Metadata {
  const title = `${product.name} | Varnam`;
  const description = product.description?.trim() || `Discover ${product.name}, ${withArticle(product.colour.toLowerCase())} ${product.type} saree from Varnam's ${product.collection} collection.`;
  const url = new URL(`/product/${product.id}`, getSiteUrl()).href;
  return {
    title: { absolute: title }, description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, siteName: 'Varnam', type: 'website',
      images: [{ url: getProductCoverImage(product), alt: product.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [getProductCoverImage(product)] },
  };
}
