'use client';

import { DeliveryPolicy } from '@/components/DeliveryPolicy';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { COLOUR_HEX_MAP, capitalizeColour } from '@/data/products';
import { useStore } from '@/context/store-context';
import { ProductCard } from '@/components/ProductCard';
import { Icon } from '@/components/Icons';
import { ProductPrice } from '@/components/ProductPrice';
import { PINCODE_PATTERN, PINCODE_PATTERN_MESSAGE } from '@/lib/address-validation';
import { getProductQuantityLimit } from '@/lib/product-quantity';
import { imageLoader, needsUnoptimized } from '@/lib/image-loader';
import { buildProductGalleryImages, clampGalleryIndex } from '@/lib/product-gallery';

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

  const hasVariants = Boolean(product?.variants && product.variants.length > 0);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

  useEffect(() => {
    setSelectedVariantIndex(0);
  }, [product?.id]);

  const activeVariant = hasVariants && product?.variants ? (product.variants[selectedVariantIndex] || product.variants[0]) : null;

  const galleryImages = buildProductGalleryImages(product, selectedVariantIndex);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id, selectedVariantIndex]);

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
    addToCart(product.id, qty, finish);
    setTimeout(() => setIsAdding(false), 300);
  };

  const handleCheckPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.length === 6) {
      setPinMessage('Demo estimate: delivery in 5–7 business days.');
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
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '14px',
                }}
              >
                {galleryImages.map((img, idx) => {
                  const isCurrent = idx === currentImageIndex;
                  return (
                    <button
                      key={img}
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      aria-label={`View photo ${idx + 1} of ${product.name}`}
                      onClick={() => setSelectedImageIndex(idx)}
                      style={{
                        position: 'relative',
                        width: '74px',
                        aspectRatio: '4/5',
                        overflow: 'hidden',
                        borderRadius: '2px',
                        border: isCurrent ? '2px solid var(--ink, #1f1d1d)' : '1px solid rgba(0,0,0,0.15)',
                        backgroundColor: '#e5dfd4',
                        cursor: 'pointer',
                        padding: 0,
                        opacity: isCurrent ? 1 : 0.65,
                        transition: 'opacity 0.2s, border-color 0.2s',
                      }}
                    >
                      <Image
                        src={img}
                        alt={`${product.name} thumbnail ${idx + 1}`}
                        fill
                        sizes="74px"
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
              {product.description || `A luminous ${capitalizeColour(product.colour).toLowerCase()} weave, finished with an intricate golden border. A graceful companion for celebrations, cherished moments, and everything in between.`}
            </p>
            <p className={`stock-state ${soldOut ? 'sold-out' : ''}`} role="status">
              {soldOut ? 'Sold out' : product.stock != null ? `${product.stock} available` : 'Please confirm availability when ordering'}
            </p>

            <div>Colour: {capitalizeColour(activeVariant ? (activeVariant.colour || activeVariant.name) : product.colour)}</div>
            {hasVariants && product.variants && product.variants.length > 0 ? (
              <div className="swatches colour-variant-switcher" role="radiogroup" aria-label="Colour variants">
                {product.variants.map((v, idx) => {
                  const varName = v.colour || v.name;
                  const isCurrent = idx === selectedVariantIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      role="radio"
                      aria-checked={isCurrent}
                      aria-label={`Select ${capitalizeColour(varName)} variant`}
                      className={`swatch ${isCurrent ? 'selected' : ''}`}
                      style={{
                        background: COLOUR_HEX_MAP[capitalizeColour(varName)] || COLOUR_HEX_MAP[varName] || '#d8d0c8',
                        cursor: 'pointer',
                        border: isCurrent ? '2px solid var(--ink, #1f1d1d)' : '1px solid rgba(0,0,0,0.2)',
                      }}
                      onClick={() => {
                        setSelectedVariantIndex(idx);
                        setSelectedImageIndex(0);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="swatches">
                {products.slice(0, 4).map((x) => (
                  <Link
                    key={x.id}
                    href={`/product/${x.id}`}
                    className={`swatch ${x.colour === product.colour ? 'selected' : ''}`}
                    style={{ background: COLOUR_HEX_MAP[capitalizeColour(x.colour)] || COLOUR_HEX_MAP[x.colour] || '#d8d0c8' }}
                    aria-label={`View ${capitalizeColour(x.colour)} saree`}
                  />
                ))}
              </div>
            )}

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
