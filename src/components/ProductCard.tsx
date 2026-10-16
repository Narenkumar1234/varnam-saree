'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { money } from '@/data/products';
import { useStore } from '@/context/store-context';
import { Icon } from './Icons';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const router = useRouter();
  const { cart, wish, toggleWish, adjustCardQuantity, addToCart } = useStore();

  const isWish = wish.includes(product.id);
  const cartItem = cart.find((item) => item.id === product.id);
  const qty = cartItem?.qty || 0;

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/checkout?buyNow=${product.id}&qty=1`);
  };

  return (
    <article className="product">
      <Link href={`/product/${product.id}`} className="product-link">
        <div className="fabric-container" style={{ position: 'relative', width: '100%', aspectRatio: '4/5', overflow: 'hidden', backgroundColor: '#e5dfd4' }}>
          <Image
            src={product.image}
            alt={`${product.colour} saree — ${product.name}`}
            fill
            sizes="(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw"
            priority={priority}
            className="product-img"
            style={{ objectFit: 'cover', transition: 'filter 0.2s, transform 0.4s' }}
          />
        </div>
        <h3>{product.name}</h3>
        <div className="meta">{product.type}</div>
        <div className="price">
          {money(product.price)}
          {product.old ? <span className="old">{money(product.old)}</span> : null}
        </div>
      </Link>

      <div className="product-actions">
        <div className="card-bag-control">
          {qty > 0 ? (
            <div className="card-quantity" role="group" aria-label={`Quantity of ${product.name} in bag`}>
              <button
                type="button"
                data-step="minus"
                aria-label={`Remove one ${product.name}`}
                onClick={() => adjustCardQuantity(product.id, -1)}
              >
                <Icon name="minus" />
              </button>
              <span aria-label={`${qty} in bag`}>{qty}</span>
              <button
                type="button"
                data-step="plus"
                aria-label={`Add one ${product.name}`}
                onClick={() => adjustCardQuantity(product.id, 1)}
              >
                <Icon name="plus" />
              </button>
            </div>
          ) : (
            <button
              className="product-action add-action"
              type="button"
              aria-label={`Add ${product.name} to bag`}
              onClick={() => adjustCardQuantity(product.id, 1)}
            >
              Add to bag
            </button>
          )}
        </div>
        <button className="product-action buy-action" type="button" onClick={handleBuyNow}>
          Buy now
        </button>
      </div>

      {product.tag && <span className="tag">{product.tag}</span>}

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
