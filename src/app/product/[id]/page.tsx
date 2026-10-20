import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import ProductDetail from '@/components/ProductDetail';
import { getCatalogue } from '@/lib/catalogue-server';
import { productMetadata } from '@/lib/product-metadata';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { products } = await getCatalogue();
  const product = products.find((entry) => entry.id === Number(id));
  return product ? productMetadata(product) : {
    title: 'Saree not found | Varnam',
    description: 'Explore the latest sarees in the Varnam collection.',
    robots: { index: false, follow: false },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <ProductDetail id={id} />
    </Suspense>
  );
}
