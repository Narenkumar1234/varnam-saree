'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { Icon } from '@/components/Icons';
import { CartItem } from '@/types';
import { previewOrderQuote } from '@/lib/pricing';
import { CouponForm } from '@/components/CouponForm';
import { OrderTotals } from '@/components/OrderTotals';
import { OrderLinePrice } from '@/components/OrderLinePrice';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, products, getProductById, couponCode, placeOrder } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const buyNowId = searchParams.get('buyNow');
  const requestedQty = Number(searchParams.get('qty') || '1');
  const buyNowFinish = searchParams.get('finish') || 'Unstitched blouse · included';

  const buyNowProduct = buyNowId ? getProductById(parseInt(buyNowId, 10)) : null;
  const buyNowQty = Number.isSafeInteger(requestedQty) && requestedQty > 0 &&
    requestedQty * (buyNowProduct?.price || 1) <= 2_147_483_497 ? requestedQty : 1;

  // Single-item direct checkout if buyNow is provided, otherwise full cart
  const checkoutItems: CartItem[] = buyNowProduct
    ? [{ id: buyNowProduct.id, qty: buyNowQty, finish: buyNowFinish }]
    : buyNowId ? [] : cart;

  const { quote: checkoutQuote, error: checkoutError } = previewOrderQuote(checkoutItems, couponCode, products);

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

  if (checkoutItems.length === 0) {
    return (
      <>
        <div className="page-title">
          <h1>Checkout</h1>
        </div>
        <div className="empty">
          <h2>{buyNowId ? 'This saree is unavailable' : 'Your bag is empty'}</h2>
          <p className="muted">Add a saree to begin checkout.</p>
          <Link className="btn" href="/shop">
            Explore sarees
          </Link>
        </div>
      </>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || checkoutError) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const orderId = await placeOrder(
        { ...formData, address: `${formData.address} ${formData.apartment}`.trim() },
        buyNowProduct ? checkoutItems : undefined
      );
      router.push(`/confirmation/${orderId}`);
    } catch (err) {
      setSubmitError(err instanceof TypeError
        ? 'Your order could not be saved. Check your connection and try again.'
        : err instanceof Error ? err.message : 'Your order could not be saved. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-title">
        <h1>{buyNowProduct ? 'Complete your purchase' : 'A step closer to beautiful'}</h1>
        <p>{buyNowProduct ? `Direct purchase for ${buyNowProduct.name}` : 'Bag / Delivery / Order'}</p>
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

            {checkoutError && <p className="coupon-feedback error" role="alert">{checkoutError}</p>}
            {submitError && <p className="coupon-feedback error" role="alert">{submitError}</p>}
            <button className="btn" type="submit" disabled={isSubmitting || !!checkoutError} style={{ width: '100%', marginTop: '24px' }}>
              {isSubmitting ? 'Placing order…' : 'Place order'} <Icon name="arrow-up-right" />
            </button>
          </form>

          <aside className="summary-box">
            <h2>Your order</h2>
            {checkoutQuote.items.map((x) => {
              return (
                <div key={x.id} className="summary-row">
                  <span>
                    {x.name} × {x.qty}
                  </span>
                  <OrderLinePrice item={x} />
                </div>
              );
            })}
            <OrderTotals pricing={checkoutQuote.pricing} />
            <CouponForm disabled={isSubmitting} />
          </aside>
        </div>
      </section>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="page-title"><h1>Loading checkout…</h1></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
