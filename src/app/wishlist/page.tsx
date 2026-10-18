'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/context/store-context';
import { ProductCard } from '@/components/ProductCard';

export default function WishlistPage() {
  const { wish, getProductById } = useStore();
  const wishProducts = wish.map((id) => getProductById(id)).filter(Boolean);

  return (
    <>
      <div className="page-title">
        <h1>Your little loves</h1>
        <p>Keep your favourite colours close.</p>
      </div>

      {wishProducts.length > 0 ? (
        <section className="section">
          <div className="products">
            {wishProducts.map((p) => p && <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      ) : (
        <div className="empty">
          <h2>Love at first weave?</h2>
          <p className="muted">Tap the heart on a saree to save it here.</p>
          <Link className="btn" href="/shop">
            Explore sarees
          </Link>
        </div>
      )}
    </>
  );
}
