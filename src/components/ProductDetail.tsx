'use client';

import { DeliveryPolicy } from '@/components/DeliveryPolicy';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { COLOUR_HEX_MAP } from '@/data/products';
import { useStore } from '@/context/store-context';
import { ProductCard } from '@/components/ProductCard';
import { Icon } from '@/components/Icons';
import { ProductPrice } from '@/components/ProductPrice';
import { getProductQuantityLimit } from '@/lib/product-quantity';

export default function ProductDetail({ id }: { id: string }) {
  const router = useRouter();
  const { products, getProductById, addToCart, wish, toggleWish, orderProductOnWhatsApp } = useStore();
  const product = getProductById(id);
  const quantityLimit = product ? getProductQuantityLimit(product) : 1;

  const [qty, setQty] = useState(1);
  const [finish, setFinish] = useState('Unstitched blouse · included');
  const [pincode, setPincode] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  useEffect(() => { setQty((current) => Math.max(1, Math.min(current, quantityLimit))); }, [product?.id, quantityLimit]);

  if (!product) {
    return (
      <div className="empty">
        <h2>Saree not found</h2>
        <p className="muted">Explore our latest collection.</p>
        <Link className="btn" href="/shop">
          Explore sarees
        </Link>
      </div>
    );
  }

  const soldOut = product.stock != null && product.stock <= 0;
  const isWish = wish.includes(product.id);
  const relatedProducts = products.filter((x) => x.id !== product.id).slice(0, 4);

  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = () => {
    if (soldOut || isAdding) return;
    setIsAdding(true);
    addToCart(product.id, qty, finish);
    setTimeout(() => setIsAdding(false), 300);
  };

  const handleCheckPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.length === 6) {
      setPinMessage('Demo estimate: delivery in 5–7 business days.');
    } else {
      setPinMessage('Please enter a valid 6-digit pincode.');
    }
  };

  return (
    <>
      <section className="section">
        <div className="breadcrumb">
          <Link href="/">Home</Link> / <Link href="/shop">Sarees</Link> / {product.name}
        </div>

        <div className="detail">
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '4/5',
              overflow: 'hidden',
              backgroundColor: '#e5dfd4',
            }}
          >
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 700px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
            />
          </div>

          <div>
            <div className="eyebrow">{product.type}</div>
            <h1>{product.name}</h1>
            <div className="rating">
              <Icon name="sparkle" />{' '}
              <span className="muted">Thoughtfully selected for the Varnam collection</span>
            </div>
            <ProductPrice price={product.price} oldPrice={product.oldPrice} />
            <small className="muted">Inclusive of all taxes</small>

            <p className="desc">
              {product.description || `A luminous ${product.colour.toLowerCase()} weave, finished with an intricate golden border. A graceful companion for celebrations, cherished moments, and everything in between.`}
            </p>
            <p className={`stock-state ${soldOut ? 'sold-out' : ''}`} role="status">
              {soldOut ? 'Sold out' : product.stock != null ? `${product.stock} available` : 'Please confirm availability when ordering'}
            </p>

            <div>Colour: {product.colour}</div>
            <div className="swatches">
              {products.slice(0, 4).map((x) => (
                <Link
                  key={x.id}
                  href={`/product/${x.id}`}
                  className={`swatch ${x.colour === product.colour ? 'selected' : ''}`}
                  style={{ background: COLOUR_HEX_MAP[x.colour] || '#d8d0c8' }}
                  aria-label={`View ${x.colour} saree`}
                />
              ))}
            </div>

            <label>
              Choose finishing
              <select value={finish} onChange={(e) => setFinish(e.target.value)}>
                <option value="Unstitched blouse · included">Unstitched blouse · included</option>
                <option value="Fall & edging · included">Fall & edging · included</option>
              </select>
            </label>

            <div className="buy-row">
              <div className="qty">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={soldOut || qty <= 1}
                  onClick={() => setQty(Math.max(1, qty - 1))}
                >
                  <Icon name="minus" />
                </button>
                <span id="pqty">{soldOut ? 0 : qty}</span>
                <button type="button" aria-label="Increase quantity" disabled={soldOut || qty >= quantityLimit} onClick={() => setQty((current) => Math.min(current + 1, quantityLimit))}>
                  <Icon name="plus" />
                </button>
              </div>

              <button
                className="btn add-bag-btn"
                type="button"
                disabled={soldOut || isAdding}
                onClick={handleAddToCart}
              >
                {soldOut ? 'Sold out' : isAdding ? 'Adding…' : 'Add to bag'} <Icon name="arrow-up-right" />
              </button>

              <button
                className="btn outline buy-now-btn"
                type="button"
                disabled={soldOut}
                onClick={() =>
                  router.push(
                    `/checkout?buyNow=${product.id}&qty=${qty}&finish=${encodeURIComponent(finish)}`
                  )
                }
              >
                Buy now
              </button>

              <button
                className={`btn outline wishlist-button ${isWish ? 'active' : ''}`}
                type="button"
                aria-label={`Save ${product.name} to wishlist`}
                aria-pressed={isWish}
                onClick={() => toggleWish(product.id)}
              >
                <Icon name={isWish ? 'heart-fill' : 'heart'} />
              </button>
            </div>

            <button
              className="whatsapp-order product-whatsapp"
              type="button"
              disabled={soldOut}
              onClick={() => orderProductOnWhatsApp(product.id, qty, finish)}
            >
              <Icon name="whatsapp" /> Order this saree on WhatsApp
            </button>

            <p className="muted" style={{ fontSize: '11px' }}>
              <DeliveryPolicy />
            </p>

            <form onSubmit={handleCheckPin}>
              <label htmlFor="pin">Check delivery availability</label>
              <div className="checkpin">
                <input
                  id="pin"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="6-digit pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  required
                />
                <button type="submit">Check</button>
              </div>
              {pinMessage && (
                <small id="pinMsg" className="muted" style={{ display: 'block', marginTop: '6px' }}>
                  {pinMessage}
                </small>
              )}
            </form>

            <details open>
              <summary>Shipping & returns</summary>
              <p>
                View our sample{' '}
                <Link className="text-link" href="/shipping">
                  shipping & return policy
                </Link>{' '}
                for details.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>You might also love</h2>
        </div>
        <div className="products">
          {relatedProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
