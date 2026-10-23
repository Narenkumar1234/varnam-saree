import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetail from '@/components/ProductDetail';
import { getCatalogue } from '@/lib/catalogue-server';
import { productMetadata } from '@/lib/product-metadata';
import { getProductCoverImage } from '@/lib/product-gallery';
import { getSiteUrl } from '@/lib/site-url';
import { withArticle } from '@/lib/article';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolved = await params;
  const id = resolved?.id;
  const numId = Number(id);
  if (!id || Number.isNaN(numId)) {
    return {
      title: 'Saree not found | Varnam',
      description: 'Explore the latest sarees in the Varnam collection.',
      robots: { index: false, follow: false },
    };
  }
  const { products } = await getCatalogue();
  const product = products.find((entry) => entry.id === numId);
  return product ? productMetadata(product) : {
    title: 'Saree not found | Varnam',
    description: 'Explore the latest sarees in the Varnam collection.',
    robots: { index: false, follow: false },
  };
}

export default async function ProductPage({ params }: Props) {
  const resolved = await params;
  const id = resolved?.id;
  const numId = Number(id);
  if (!id || Number.isNaN(numId)) {
    notFound();
  }
  const { products } = await getCatalogue();
  const product = products.find((entry) => entry.id === numId);
  if (!product) {
    notFound();
  }

  const coverImage = getProductCoverImage(product);
  const imageUrl = coverImage.startsWith('http') ? coverImage : new URL(coverImage, getSiteUrl()).href;
  const productUrl = new URL(`/product/${product.id}`, getSiteUrl()).href;
  const description = product.description?.trim() || `Discover ${product.name}, ${withArticle(product.colour.toLowerCase())} ${product.type} saree from Varnam's ${product.collection} collection.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: [imageUrl],
    description,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'INR',
      availability: product.stock != null && product.stock <= 0
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url: productUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetail id={id} />
    </>
  );
}
