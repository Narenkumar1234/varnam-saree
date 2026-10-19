'use client';

import { DeliveryPolicy } from '@/components/DeliveryPolicy';
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/context/store-context';
import { Icon } from '@/components/Icons';
import { CartItem } from '@/types';
import { previewOrderQuote } from '@/lib/pricing';
import { CouponForm } from '@/components/CouponForm';
import { OrderTotals } from '@/components/OrderTotals';
import { OrderLinePrice } from '@/components/OrderLinePrice';
import { AddressFields } from '@/components/AddressFields';
import { ADDRESS_FIELDS, readSavedAddress } from '@/lib/address-storage';
import { formatWhatsAppOrderMessage } from '@/lib/whatsapp';
import type { DeliveryAddress } from '@/types';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, products, commerce, getProductById, couponCode, placeOrder, openWhatsAppMessage } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const buyNowId = searchParams.get('buyNow');
  const requestedQty = Number(searchParams.get('qty') || '1');
  const buyNowFinish = searchParams.get('finish') || 'Unstitched blouse · included';

  const buyNowProduct = buyNowId ? getProductById(parseInt(buyNowId, 10)) : null;
  const buyNowQty = requestedQty;
  const quantityError = buyNowProduct && (!Number.isSafeInteger(requestedQty) || requestedQty < 1)
    ? 'Choose a whole quantity of at least 1. Return to the product page to update your order.' : null;

  // Single-item direct checkout if buyNow is provided, otherwise full cart
  const checkoutItems: CartItem[] = buyNowProduct
    ? [{ id: buyNowProduct.id, qty: buyNowQty, finish: buyNowFinish }]
    : buyNowId ? [] : cart;

  const { quote: checkoutQuote, error: quoteError } = previewOrderQuote(checkoutItems, couponCode, products, commerce);
  const checkoutError = quantityError || quoteError;

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

  useEffect(() => {
    const saved = readSavedAddress();
    if (saved) setFormData((current) => {
      const next = { ...current };
      for (const field of ADDRESS_FIELDS) if (!next[field]) next[field] = saved[field];
      return next;
    });
  }, []);

  const updateAddress = (field: keyof DeliveryAddress, value: string) => setFormData((current) => ({ ...current, [field]: value }));

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

  const handleWhatsAppCheckout = () => {
    if (checkoutError) return;
    const customerName = `${formData.first} ${formData.last}`.trim();
    const fullAddress = [
      formData.address,
      formData.apartment,
      formData.city,
      formData.state,
      formData.pin,
    ].filter(Boolean).join(', ');

    const lines = [
      buyNowProduct ? `Direct purchase for: ${buyNowProduct.name}` : `Bag Order (${checkoutQuote.items.length} sarees):`,
      '',
      ...checkoutQuote.items.map((x) => `• ${x.name} × ${x.qty} — ₹${x.total || x.unitPrice * x.qty}`),
      '',
      `Subtotal: ₹${checkoutQuote.pricing.subtotal}`,
      ...(checkoutQuote.pricing.discountAmount > 0 && checkoutQuote.pricing.couponCode ? [`Coupon (${checkoutQuote.pricing.couponCode}): −₹${checkoutQuote.pricing.discountAmount}`] : []),
      `Delivery: ${checkoutQuote.pricing.shipping ? `₹${checkoutQuote.pricing.shipping}` : 'Free delivery'}`,
      `Total: ₹${checkoutQuote.pricing.total}`,
      '',
      ...(customerName ? [`Customer: ${customerName}`] : []),
      ...(formData.phone ? [`Phone: ${formData.phone}`] : []),
      ...(formData.email ? [`Email: ${formData.email}`] : []),
      ...(fullAddress ? [`Delivery address: ${fullAddress}`] : []),
    ];

    openWhatsAppMessage(formatWhatsAppOrderMessage(lines, 'Hello Varnam, I would like to place this order on WhatsApp:', 'Please confirm my order and share delivery / payment details.'));
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
              <AddressFields value={formData} onChange={updateAddress} fields={['first', 'last']} />

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
              <AddressFields value={formData} onChange={updateAddress} fields={['phone', 'address']} />

              <label className="wide">
                Apartment, landmark (optional)
                <input
                  name="apartment"
                  autoComplete="address-line2"
                  value={formData.apartment}
                  onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                />
              </label>
              <AddressFields value={formData} onChange={updateAddress} fields={['city', 'pin', 'state']} />

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
            {checkoutError && <p><Link className="text-link" href={buyNowProduct ? `/product/${buyNowProduct.id}` : '/cart'}>{buyNowProduct ? 'Review this saree' : 'Review your bag'}</Link></p>}
            {submitError && <p className="coupon-feedback error" role="alert">{submitError}</p>}
            <button className="btn" type="submit" disabled={isSubmitting || !!checkoutError} style={{ width: '100%', marginTop: '24px' }}>
              {isSubmitting ? 'Placing order…' : 'Place order'} <Icon name="arrow-up-right" />
            </button>
            <div className="checkout-or-divider" aria-hidden="true">
              <span>or</span>
            </div>
            <button
              type="button"
              className="whatsapp-order"
              style={{ width: '100%', minHeight: '48px', justifyContent: 'center' }}
              disabled={isSubmitting || !!checkoutError}
              onClick={handleWhatsAppCheckout}
            >
              <Icon name="whatsapp" /> Order on WhatsApp
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
            <p className="muted delivery-policy"><DeliveryPolicy includeFee /></p>
            <CouponForm disabled={isSubmitting} items={checkoutItems} />
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
