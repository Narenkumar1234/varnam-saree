'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/context/store-context';
import { getProductById, money } from '@/data/products';
import { Icon } from '@/components/Icons';

export default function CartPage() {
  const {
    cart,
    subtotal,
    total,
    shipping,
    discount,
    discountAmount,
    adjustCardQuantity,
    removeItem,
    applyCoupon,
    orderCartOnWhatsApp,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');

  const handleCouponSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponInput.trim()) {
      applyCoupon(couponInput);
    }
  };

  return (
    <>
      <div className="page-title">
        <h1>Your bag</h1>
        <p>A few beautiful things, just for you.</p>
      </div>

      {cart.length === 0 ? (
        <div className="empty">
          <h2>Your next favourite is waiting</h2>
          <p className="muted">Your bag is empty. Find a weave to make your own.</p>
          <Link className="btn" href="/shop">
            Explore sarees
          </Link>
        </div>
      ) : (
        <section className="section" style={{ paddingTop: '10px' }}>
          <div className="cart-layout">
            <div>
              {cart.map((item) => {
                const p = getProductById(item.id);
                if (!p) return null;

                return (
                  <div key={item.id} className="cart-item">
                    <Link
                      href={`/product/${p.id}`}
                      style={{
                        position: 'relative',
                        width: '100px',
                        height: '125px',
                        overflow: 'hidden',
                        display: 'block',
                      }}
                    >
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="100px"
                        style={{ objectFit: 'cover' }}
                      />
                    </Link>

                    <div>
                      <h3>
                        <Link href={`/product/${p.id}`}>{p.name}</Link>
                      </h3>
                      <p className="meta muted">
                        {p.type} · {p.colour}
                        <br />
                        {item.finish || 'Unstitched blouse · included'}
                      </p>
                      <div className="qty">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => adjustCardQuantity(item.id, -1)}
                        >
                          <Icon name="minus" />
                        </button>
                        <span>{item.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => adjustCardQuantity(item.id, 1)}
                        >
                          <Icon name="plus" />
                        </button>
                      </div>
                      <button
                        className="remove"
                        type="button"
                        onClick={() => removeItem(item.id)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="price">{money(p.price * item.qty)}</div>
                  </div>
                );
              })}

              <p style={{ marginTop: '20px' }}>
                <Link className="text-link" href="/shop">
                  Continue exploring
                </Link>
              </p>
            </div>

            <aside className="summary-box">
              <h2>Your order</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>Delivery</span>
                <span>{shipping ? money(shipping) : 'Complimentary'}</span>
              </div>
              {discount && (
                <div className="summary-row">
                  <span>WELCOME10</span>
                  <span>−{money(discountAmount)}</span>
                </div>
              )}
              <div className="summary-row total">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>

              <Link className="btn" href="/checkout">
                Continue to checkout <Icon name="arrow-up-right" />
              </Link>

              <button
                className="whatsapp-order"
                type="button"
                onClick={orderCartOnWhatsApp}
              >
                <Icon name="whatsapp" /> Order on WhatsApp
              </button>

              <small>Taxes included in the total.</small>

              <form className="coupon" onSubmit={handleCouponSubmit}>
                <label htmlFor="coupon">Have a little gift code?</label>
                <div className="inline">
                  <input
                    id="coupon"
                    placeholder="Try WELCOME10"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                  />
                  <button type="submit">Apply</button>
                </div>
              </form>
            </aside>
          </div>
        </section>
      )}
    </>
  );
}
