'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { getProductById, money } from '@/data/products';
import { Icon } from '@/components/Icons';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, total, shipping, discount, discountAmount, placeOrder } = useStore();

  const [formData, setFormData] = useState({
    first: '',
    last: '',
    email: '',
    phone: '',
    address: '',
    apartment: '',
    city: '',
    pin: '',
    state: '',
    country: 'India',
  });

  if (cart.length === 0) {
    return (
      <>
        <div className="page-title">
          <h1>Checkout</h1>
        </div>
        <div className="empty">
          <h2>Your bag is empty</h2>
          <p className="muted">Add a saree to begin checkout.</p>
          <Link className="btn" href="/shop">
            Explore sarees
          </Link>
        </div>
      </>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const orderId = placeOrder(formData);
    router.push(`/confirmation/${orderId}`);
  };

  return (
    <>
      <div className="page-title">
        <h1>A step closer to beautiful</h1>
        <p>Bag / Delivery / Demo order</p>
      </div>

      <section className="section" style={{ paddingTop: '10px' }}>
        <div className="cart-layout">
          <form id="checkoutForm" onSubmit={handleSubmit}>
            <h2>Contact & delivery</h2>
            <div className="form-grid">
              <label>
                First name
                <input
                  name="first"
                  autoComplete="given-name"
                  required
                  value={formData.first}
                  onChange={(e) => setFormData({ ...formData, first: e.target.value })}
                />
              </label>
              <label>
                Last name
                <input
                  name="last"
                  autoComplete="family-name"
                  required
                  value={formData.last}
                  onChange={(e) => setFormData({ ...formData, last: e.target.value })}
                />
              </label>
              <label className="wide">
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </label>
              <label className="wide">
                Phone number
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  pattern="[0-9+ ()-]{10,16}"
                  required
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </label>
              <label className="wide">
                Street address
                <input
                  name="address"
                  autoComplete="address-line1"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </label>
              <label className="wide">
                Apartment, landmark (optional)
                <input
                  name="apartment"
                  autoComplete="address-line2"
                  value={formData.apartment}
                  onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                />
              </label>
              <label>
                City
                <input
                  name="city"
                  autoComplete="address-level2"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </label>
              <label>
                Pincode
                <input
                  name="pin"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                />
              </label>
              <label>
                State
                <input
                  name="state"
                  autoComplete="address-level1"
                  required
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </label>
              <label>
                Country
                <select
                  name="country"
                  autoComplete="country-name"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                >
                  <option value="India">India</option>
                </select>
              </label>
            </div>

            <h3>Delivery method</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="radio" checked readOnly name="delivery" /> Standard delivery · 5–7 business
              days
            </label>

            <h3>Payment</h3>
            <div className="demo-note">
              This is a sample shopping experience. Place a demo order to preview the confirmation and
              tracking screens. No payment is taken and no real shipment is created.
            </div>

            <button className="btn" type="submit" style={{ width: '100%', marginTop: '24px' }}>
              Place demo order <Icon name="arrow-up-right" />
            </button>
          </form>

          <aside className="summary-box">
            <h2>Your order</h2>
            {cart.map((x) => {
              const p = getProductById(x.id);
              if (!p) return null;
              return (
                <div key={x.id} className="summary-row">
                  <span>
                    {p.name} × {x.qty}
                  </span>
                  <span>{money(p.price * x.qty)}</span>
                </div>
              );
            })}
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
            <small>Demo checkout · no payment is collected.</small>
          </aside>
        </div>
      </section>
    </>
  );
}
