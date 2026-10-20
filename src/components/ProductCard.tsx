'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { useStore } from '@/context/store-context';
import { Icon } from './Icons';
import { ProductPrice } from './ProductPrice';
import { getProductQuantityLimit } from '@/lib/product-quantity';
import { getProductDiscountPercentage } from '@/lib/shop-filters';
import { capitalizeColour } from '@/lib/colour';
import { imageLoader, needsUnoptimized } from '@/lib/image-loader';
import { getProductCoverImage } from '@/lib/product-gallery';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const router = useRouter();
  const { cart, wish, toggleWish, adjustCardQuantity } = useStore();

  const soldOut = product.stock != null && product.stock <= 0;
  const stockText = soldOut ? 'Sold out' : product.stock != null ? `${product.stock} available` : '';
  const isWish = wish.includes(product.id);
  const cartItem = cart.find((item) => item.id === product.id);
  const qty = cartItem?.qty || 0;
  const discountPct = getProductDiscountPercentage(product);

  const coverImage = getProductCoverImage(product);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const handleAdjust = (delta: number) => {
    if (isDebouncing) return;
    setIsDebouncing(true);
    adjustCardQuantity(product.id, delta);
    setTimeout(() => setIsDebouncing(false), 250);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    if (soldOut) return;
    router.push(`/checkout?buyNow=${product.id}&qty=1`);
  };

  return (
    <article className="product">
      <Link href={`/product/${product.id}`} className="product-link">
        <div className="fabric-container" style={{ position: 'relative', width: '100%', aspectRatio: '4/5', overflow: 'hidden', backgroundColor: '#e5dfd4' }}>
          <Image
            src={coverImage}
            alt={`${capitalizeColour(product.colour)} saree — ${product.name}`}
            fill
            sizes="(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw"
            priority={priority}
            className="product-img"
            style={{ objectFit: 'cover', transition: 'filter 0.2s, transform 0.4s' }}
            loader={imageLoader}
            unoptimized={needsUnoptimized(coverImage)}
          />
        </div>
        <h3>{product.name}</h3>
        <div className="meta">{product.type}</div>
        <ProductPrice price={product.price} oldPrice={product.oldPrice} />
      </Link>

      {stockText && <p className={`stock-state ${soldOut ? 'sold-out' : ''}`}>{stockText}</p>}
      <div className="product-actions">
        <div className="card-bag-control">
          {qty > 0 ? (
            <div className="card-quantity" role="group" aria-label={`Quantity of ${product.name} in bag`}>
              <button
                type="button"
                data-step="minus"
                aria-label={`Remove one ${product.name}`}
                disabled={isDebouncing}
                onClick={() => handleAdjust(-1)}
              >
                <Icon name="minus" />
              </button>
              <span aria-label={`${qty} in bag`}>{qty}</span>
              <button
                type="button"
                data-step="plus"
                aria-label={`Add one ${product.name}`}
                disabled={isDebouncing || soldOut || qty >= getProductQuantityLimit(product)}
                onClick={() => handleAdjust(1)}
              >
                <Icon name="plus" />
              </button>
            </div>
          ) : (
            <button
              className="product-action add-action"
              type="button"
              aria-label={`Add ${product.name} to bag`}
              disabled={soldOut || isDebouncing}
              onClick={() => handleAdjust(1)}
            >
              {soldOut ? 'Sold out' : 'Add to bag'}
            </button>
          )}
        </div>
        <button className="product-action buy-action" type="button" disabled={soldOut} onClick={handleBuyNow}>
          Buy now
        </button>
      </div>

      <div className="product-badges">
        {discountPct > 0 && <span className="product-discount-badge">{discountPct}% OFF</span>}
        {product.tag && <span className="tag">{product.tag}</span>}
      </div>

      <button
        className={`heart ${isWish ? 'active' : ''}`}
        aria-label={`Save ${product.name} to wishlist`}
        aria-pressed={isWish}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          toggleWish(product.id);
        }}
      >
        <Icon name={isWish ? 'heart-fill' : 'heart'} />
      </button>
    </article>
  );
}
