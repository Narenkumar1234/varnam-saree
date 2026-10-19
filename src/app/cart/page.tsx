'use client';

import { DeliveryPolicy } from '@/components/DeliveryPolicy';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/context/store-context';
import { Icon } from '@/components/Icons';
import { CouponForm } from '@/components/CouponForm';
import { OrderTotals } from '@/components/OrderTotals';
import { OrderLinePrice } from '@/components/OrderLinePrice';
import { getProductQuantityLimit } from '@/lib/product-quantity';
import { capitalizeColour } from '@/lib/colour';

export default function CartPage() {
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const {
    cart,
    getProductById, cartError,
    cartQuote,
    adjustCardQuantity,
    removeItem,
    orderCartOnWhatsApp,
  } = useStore();

  const handleAdjust = (id: number, delta: number) => {
    if (busyId === id) return;
    setBusyId(id);
    adjustCardQuantity(id, delta);
    setTimeout(() => setBusyId(null), 250);
  };

  const handleRemove = (id: number) => {
    if (busyId === id) return;
    setBusyId(id);
    removeItem(id);
    setTimeout(() => setBusyId(null), 250);
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
                if (!p) return <div className="cart-item" key={item.id}><p>This saree is no longer available.</p><button type="button" onClick={() => handleRemove(item.id)}>Remove</button></div>;
                const pricedItem = cartQuote.items.find((line) => line.id === item.id);

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
                        {p.type} · {capitalizeColour(p.colour)}
                        <br />
                        {item.finish || 'Unstitched blouse · included'}
                      </p>
                      {p.stock === 0 && <p className="stock-state sold-out">Sold out</p>}
                      <div className="qty">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          disabled={busyId === item.id}
                          onClick={() => handleAdjust(item.id, -1)}
                        >
                          <Icon name="minus" />
                        </button>
                        <span>{item.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          disabled={busyId === item.id || item.qty >= getProductQuantityLimit(p)}
                          onClick={() => handleAdjust(item.id, 1)}
                        >
                          <Icon name="plus" />
                        </button>
                      </div>
                      <button
                        className="remove"
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleRemove(item.id)}
                      >
                        Remove
                      </button>
                    </div>

                    {pricedItem && <OrderLinePrice item={pricedItem} />}
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
              <p className="muted delivery-policy"><DeliveryPolicy includeFee /></p>

              {cartError && <p className="coupon-feedback error" role="alert">{cartError}</p>}
              <Link className="btn" href={cartError ? '/cart' : '/checkout'} aria-disabled={!!cartError} onClick={(event) => { if (cartError) event.preventDefault(); }}>
                Continue to checkout <Icon name="arrow-up-right" />
              </Link>

              <button
                className="whatsapp-order"
                type="button"
                disabled={!!cartError}
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
