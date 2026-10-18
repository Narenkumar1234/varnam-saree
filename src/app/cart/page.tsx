'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/context/store-context';
import { getProductById } from '@/data/products';
import { Icon } from '@/components/Icons';
import { CouponForm } from '@/components/CouponForm';
import { OrderTotals } from '@/components/OrderTotals';
import { OrderLinePrice } from '@/components/OrderLinePrice';

export default function CartPage() {
  const {
    cart,
    cartQuote,
    adjustCardQuantity,
    removeItem,
    orderCartOnWhatsApp,
  } = useStore();

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
              {cartQuote.items.map((item) => {
                const p = getProductById(item.id);
                if (!p) return null;

                return (
                  <div key={item.id} className="cart-item">
                    <Link href={`/product/${p.id}`} className="cart-item-image">
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="(max-width: 700px) 85px, 100px"
                        style={{ objectFit: 'cover' }}
                      />
                    </Link>

                    <div className="cart-item-details">
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

                    <OrderLinePrice item={item} />
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
              <OrderTotals pricing={cartQuote.pricing} />

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

              <CouponForm />
            </aside>
          </div>
        </section>
      )}
    </>
  );
}
