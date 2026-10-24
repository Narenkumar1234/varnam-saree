'use client';

import { DeliveryPolicy } from '@/components/DeliveryPolicy';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { capitalizeColour } from '@/lib/colour';
import { useStore } from '@/context/store-context';
import { ProductCard } from '@/components/ProductCard';
import { Icon } from '@/components/Icons';
import { ProductPrice } from '@/components/ProductPrice';
import { PINCODE_PATTERN, PINCODE_PATTERN_MESSAGE } from '@/lib/address-validation';
import { getProductQuantityLimit } from '@/lib/product-quantity';
import { imageLoader, needsUnoptimized } from '@/lib/image-loader';
import { QuantityStepper } from '@/components/QuantityStepper';
import { buildProductGalleryImages, clampGalleryIndex } from '@/lib/product-gallery';

export default function ProductDetail({ id }: { id: string }) {
  const router = useRouter();
  const { products, getProductById, addToCart, wish, toggleWish, orderProductOnWhatsApp } = useStore();
  const product = getProductById(id);
  const quantityLimit = product ? getProductQuantityLimit(product) : 1;

  const [qty, setQty] = useState(1);
  const [pincode, setPincode] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  useEffect(() => { setQty((current) => Math.max(1, Math.min(current, quantityLimit))); }, [product?.id, quantityLimit]);

  // Storefront shows the product's own photos only; colour variants are not offered.
  const galleryImages = buildProductGalleryImages(product ? { ...product, variants: null } : product);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id]);

  const currentImageIndex = clampGalleryIndex(selectedImageIndex, galleryImages.length);
  const currentImage = galleryImages[currentImageIndex] || product?.image || '';

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
    addToCart(product.id, qty);
    setTimeout(() => setIsAdding(false), 300);
  };

  const handleCheckPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.length === 6) {
      setPinMessage('Estimated delivery in 5–7 business days.');
    } else {
      setPinMessage(PINCODE_PATTERN_MESSAGE);
    }
  };

  return (
    <>
      <section className="section">
        <div className="breadcrumb">
          <Link href="/">Home</Link> / <Link href="/shop">Sarees</Link> / {product.name}
        </div>

        <div className="detail">
          <div className="product-gallery">
            <div className="product-gallery-stage">
              <div className="product-gallery-main">
                <Image
                  key={currentImage}
                  src={currentImage}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 700px) 100vw, 50vw"
                  style={{ objectFit: 'cover' }}
                  loader={imageLoader}
                  unoptimized={needsUnoptimized(currentImage)}
                />
              </div>

              {galleryImages.length > 1 && (
                <div
                  className="gallery-thumbnails"
                  role="tablist"
                  aria-label={`${product.name} image gallery`}
                >
                  {galleryImages.map((img, idx) => {
                    const isCurrent = idx === currentImageIndex;
                    return (
                      <button
                        key={img}
                        type="button"
                        role="tab"
                        className={`gallery-thumb${isCurrent ? ' is-active' : ''}`}
                        aria-selected={isCurrent}
                        aria-label={`View photo ${idx + 1} of ${product.name}`}
                        onClick={() => setSelectedImageIndex(idx)}
                      >
                        <Image
                          src={img}
                          alt={`${product.name} thumbnail ${idx + 1}`}
                          fill
                          sizes="72px"
                          style={{ objectFit: 'cover' }}
                          loader={imageLoader}
                          unoptimized={needsUnoptimized(img)}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="eyebrow">{product.type}</div>
            <h1>{product.name}</h1>
            <ProductPrice price={product.price} oldPrice={product.oldPrice} />
            <small className="muted">Inclusive of all taxes</small>

            <p className="desc">
              {product.description || `A luminous ${capitalizeColour(product.colour).toLowerCase()} weave, finished with an intricate golden border. A graceful companion for celebrations, cherished moments, and everything in between.`}
            </p>
            <p className={`stock-state ${soldOut ? 'sold-out' : ''}`} role="status">
              {soldOut ? 'Sold out' : product.stock != null ? `${product.stock} available` : 'Please confirm availability when ordering'}
            </p>

            <div className="product-colour">Colour: {capitalizeColour(product.colour)}</div>

            <p className="blouse-note">Includes unstitched blouse piece</p>

            <div className="buy-row">
              <QuantityStepper
                value={soldOut ? 0 : qty}
                valueId="pqty"
                onDecrease={() => setQty(Math.max(1, qty - 1))}
                onIncrease={() => setQty((current) => Math.min(current + 1, quantityLimit))}
                decreaseDisabled={soldOut || qty <= 1}
                increaseDisabled={soldOut || qty >= quantityLimit}
                aria-label={`Quantity of ${product.name}`}
              />

              <div className="buy-actions">
                <button
                  className="btn add-bag-btn"
                  type="button"
                  disabled={soldOut || isAdding}
                  onClick={handleAddToCart}
                >
                  {soldOut ? (
                    'Sold out'
                  ) : (
                    <>
                      {isAdding ? 'Adding…' : 'Add to bag'} <Icon name="arrow-up-right" />
                    </>
                  )}
                </button>

                <button
                  className="btn outline buy-now-btn"
                  type="button"
                  disabled={soldOut}
                  onClick={() => {
                    router.push(`/checkout?buyNow=${product.id}&qty=${qty}`);
                  }}
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
            </div>

            <button
              className="whatsapp-order product-whatsapp"
              type="button"
              disabled={soldOut}
              onClick={() => orderProductOnWhatsApp(product.id, qty)}
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
                  pattern={PINCODE_PATTERN}
                  maxLength={6}
                  title={PINCODE_PATTERN_MESSAGE}
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
              <summary>Shipping & replacement</summary>
              <p>
                Dispatched within 2 business days; delivered in 5–7 business days. No returns —
                damaged, defective or wrong items are replaced with an unboxing video.{' '}
                <Link className="text-link" href="/shipping">
                  Shipping policy
                </Link>{' '}
                ·{' '}
                <Link className="text-link" href="/refund">
                  Replacement policy
                </Link>
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
