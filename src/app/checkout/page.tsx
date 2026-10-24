'use client';

import { DeliveryPolicy } from '@/components/DeliveryPolicy';
import React, { useState, useEffect, useRef, Suspense } from 'react';
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
import { ADDRESS_FIELDS, customerAddressPayload, deliveryFromCustomerAddress, markAddressMigrated, readSavedAddress, shouldMigrateBrowserAddress } from '@/lib/address-storage';
import type { CustomerAddress, DeliveryAddress } from '@/types';
import { loadRazorpayCheckout } from '@/components/StudioPayment';
import { buildCustomerRazorpayOptions } from '@/lib/customer-razorpay';
import { money } from '@/data/products';
import { createWhatsAppOrderUrl, openPendingWhatsAppWindow, checkoutWhatsAppMessage } from '@/lib/whatsapp';
import { useCustomerAccount } from '@/hooks/use-customer-account';
import { customerAuthHeaders } from '@/lib/customer-auth-headers';
import { ProductThumb } from '@/components/ProductThumb';
import { resolveOrderLineImage } from '@/lib/product-gallery';
import { capitalizeColour } from '@/lib/colour';

async function razorpayRequest(endpoint: string, body: unknown) {
  const response = await fetch(`/api/payments/razorpay/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Payment could not be completed.');
  return result;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, products, commerce, getProductById, couponCode, placeOrder, updateOrderPayment } = useStore();
  const [isSubmitting, setSubmittingState] = useState(false);
  // Synchronous guard: a double-click fires twice before React re-renders the disabled button.
  const submittingRef = useRef(false);
  const setIsSubmitting = (value: boolean) => { submittingRef.current = value; setSubmittingState(value); };
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'whatsapp'>('online');
  const [paymentPhase, setPaymentPhase] = useState<'form' | 'paying' | 'error'>('form');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const savedTotal = useRef(0);
  const { profile } = useCustomerAccount();
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | 'new'>('new');
  const [saveThisAddress, setSaveThisAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState('');

  const buyNowId = searchParams.get('buyNow');
  const requestedQty = Number(searchParams.get('qty') || '1');

  const buyNowProduct = buyNowId ? getProductById(parseInt(buyNowId, 10)) : null;
  const buyNowQty = requestedQty;
  const quantityError = buyNowProduct && (!Number.isSafeInteger(requestedQty) || requestedQty < 1)
    ? 'Choose a whole quantity of at least 1. Return to the product page to update your order.' : null;

  // Single-item direct checkout if buyNow is provided, otherwise full cart
  const checkoutItems: CartItem[] = buyNowProduct
    ? [{ id: buyNowProduct.id, qty: buyNowQty }]
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
    landmark: '',
    city: '',
    pin: '',
    state: '',
    country: 'India',
  });

  useEffect(() => {
    if (profile?.email) {
      setFormData((current) => current.email ? current : { ...current, email: profile.email });
    }
  }, [profile?.email]);

  useEffect(() => {
    if (!profile) {
      const saved = readSavedAddress();
      if (saved) setFormData((current) => {
        const next = { ...current };
        for (const field of ADDRESS_FIELDS) if (!next[field]) next[field] = saved[field];
        return next;
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const headers = await customerAuthHeaders();
        const pending = shouldMigrateBrowserAddress(profile.uid);
        if (pending && pending.address && pending.pin && pending.phone) {
          const migrate = await fetch('/api/addresses', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(customerAddressPayload({ ...pending, label: pending.label || 'Home' }, { isDefault: true })),
          });
          if (migrate.ok) markAddressMigrated(profile.uid);
        } else {
          markAddressMigrated(profile.uid);
        }
        const response = await fetch('/api/addresses', { headers, cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (cancelled || !response.ok || !Array.isArray(data?.addresses)) return;
        setSavedAddresses(data.addresses);
        const preferred = data.addresses.find((address: CustomerAddress) => address.isDefault) || data.addresses[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setFormData((current) => ({ ...current, ...deliveryFromCustomerAddress(preferred), email: current.email || profile.email }));
        }
      } catch { /* Guest-style checkout remains available if the address book cannot load. */ }
    })();
    return () => { cancelled = true; };
  }, [profile]);

  const updateAddress = (field: keyof DeliveryAddress, value: string) => setFormData((current) => ({ ...current, [field]: value }));

  // --- Razorpay payment flow (called after order placement) ---
  const startRazorpayPayment = async (orderId: string) => {
    setPaymentPhase('paying');
    setPaymentMessage('Starting payment…');
    try {
      const result = await razorpayRequest('order', { orderId });
      if (result.status === 'paid') {
        updateOrderPayment(orderId, { provider: 'razorpay', status: 'paid', razorpayOrderId: '', amount: result.amount || 0, currency: 'INR' });
        router.push(`/confirmation/${orderId}`);
        return;
      }
      if (result.status === 'processing') {
        router.push(`/confirmation/${orderId}`);
        return;
      }
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error('Razorpay is unavailable. Please complete your order on WhatsApp.');
      setPaymentMessage('');
      let submitted = false;
      const checkout = new window.Razorpay(buildCustomerRazorpayOptions({
        key: result.keyId, order_id: result.orderId, amount: result.amount, currency: result.currency,
        name: 'Varnam Saree', description: `Order ${orderId}`,
        prefill: { name: `${formData.first} ${formData.last}`.trim(), email: formData.email, contact: formData.phone },
        theme: { color: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#392535' },
        handler: (proof) => {
          submitted = true;
          void (async () => {
            setPaymentMessage('Verifying payment…');
            try {
              const verifyResult = await razorpayRequest('verify', { orderId, ...proof });
              if (verifyResult.status === 'paid') {
                updateOrderPayment(orderId, {
                  provider: 'razorpay', status: 'paid',
                  razorpayOrderId: proof.razorpay_order_id, amount: result.amount,
                  currency: 'INR', paymentId: proof.razorpay_payment_id,
                });
              }
              router.push(`/confirmation/${orderId}`);
            } catch (err) {
              setPaymentPhase('error');
              setPaymentMessage(err instanceof Error ? err.message : 'Payment verification pending. Your order is saved — do not pay again.');
              setIsSubmitting(false);
            }
          })();
        },
        modal: { ondismiss: () => {
          if (submitted) return;
          setPaymentPhase('error');
          setPaymentMessage('Payment window closed. Your order is saved.');
          setIsSubmitting(false);
        } },
      }));
      checkout.on('payment.failed', () => {
        setPaymentMessage('Payment failed. You can retry in the payment window or close it.');
      });
      checkout.open();
    } catch (err) {
      setPaymentPhase('error');
      setPaymentMessage(err instanceof Error ? err.message : 'Payment could not start. Your order is saved.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current || checkoutError) return;
    // "Order on WhatsApp instead" is a submit button for the same form, so it gets the
    // same validation and the same saved order; it only switches the payment method.
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const method: 'online' | 'whatsapp' = submitter?.dataset.payment === 'whatsapp' ? 'whatsapp' : paymentMethod;
    if (method !== paymentMethod) setPaymentMethod(method);
    setIsSubmitting(true);
    setSubmitError(null);
    // Open the WhatsApp tab now, inside the click, so popup blockers allow it. It is
    // pointed at the chat once the order (and its ID) is saved.
    const whatsAppWindow = method === 'whatsapp' ? openPendingWhatsAppWindow() : null;
    const quote = checkoutQuote;
    try {
      const orderId = await placeOrder(
        {
          ...formData,
          saveAddress: Boolean(profile) && saveThisAddress,
          addressLabel,
        },
        buyNowProduct ? checkoutItems : undefined
      );

      if (method === 'whatsapp') {
        const whatsAppUrl = createWhatsAppOrderUrl(checkoutWhatsAppMessage(orderId, quote, formData, window.location.origin));
        if (whatsAppWindow && !whatsAppWindow.closed && whatsAppUrl) {
          whatsAppWindow.location.replace(whatsAppUrl);
          router.push(`/confirmation/${orderId}?via=whatsapp`);
        } else {
          // Popup blocked: the confirmation page takes over this tab and opens WhatsApp
          // from there, so Back from WhatsApp returns to the confirmation.
          whatsAppWindow?.close();
          router.push(`/confirmation/${orderId}?via=whatsapp&open=1`);
        }
        return;
      }

      // Razorpay: order saved, now initiate payment
      savedTotal.current = quote.pricing.total;
      setPlacedOrderId(orderId);
      await startRazorpayPayment(orderId);
    } catch (err) {
      whatsAppWindow?.close();
      setSubmitError(err instanceof TypeError
        ? 'Your order could not be saved. Check your connection and try again.'
        : err instanceof Error ? err.message : 'Your order could not be saved. Please try again.');
      setIsSubmitting(false);
    }
  };

  // --- Payment progress / error view (shown after order is placed) ---
  if (placedOrderId && paymentPhase !== 'form') {
    const whatsAppUrl = createWhatsAppOrderUrl(
      `Hello Varnam, I need help completing payment for order ${placedOrderId} (${money(savedTotal.current)}). Please help me arrange payment and delivery.`
    );
    return (
      <>
        <div className="page-title">
          <h1>Complete your payment</h1>
          <p>Order <strong>{placedOrderId}</strong> is saved</p>
        </div>
        <section className="section" style={{ paddingTop: '10px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
          {paymentPhase === 'paying' && (
            <p role="status" style={{ padding: '40px 0' }}>{paymentMessage || 'Opening payment window…'}</p>
          )}
          {paymentPhase === 'error' && (
            <>
              <p className="coupon-feedback error" role="alert">{paymentMessage}</p>
              <button className="btn" type="button" onClick={() => void startRazorpayPayment(placedOrderId)} style={{ width: '100%', marginTop: '16px' }}>
                Retry payment
              </button>
              {whatsAppUrl && (
                <p style={{ marginTop: '12px' }}>
                  <a className="text-link" href={whatsAppUrl}>Complete on WhatsApp instead</a>
                </p>
              )}
              <p style={{ marginTop: '16px' }}>
                <Link className="text-link" href={`/confirmation/${placedOrderId}`}>View your order →</Link>
              </p>
              <p className="muted" style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                Your order is saved. You can pay online, arrange payment on WhatsApp, or pay later from your order page.
              </p>
            </>
          )}
        </section>
      </>
    );
  }

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

  return (
    <>
      <div className="page-title">
        <h1>{buyNowProduct ? 'Complete your purchase' : 'A step closer to beautiful'}</h1>
        <p>{buyNowProduct ? `Direct purchase for ${buyNowProduct.name}` : 'Bag / Delivery / Order'}</p>
      </div>

      <section className="section" style={{ paddingTop: '10px' }}>
        <div className="cart-layout">
          <form id="checkoutForm" onSubmit={handleSubmit}>
            <h2>Contact &amp; delivery</h2>
            {profile && savedAddresses.length > 0 && (
              <div className="saved-address-picker">
                <h3 style={{ marginTop: 0 }}>Saved addresses</h3>
                {savedAddresses.map((address) => (
                  <label key={address.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="radio"
                      name="saved-address"
                      checked={selectedAddressId === address.id}
                      onChange={() => {
                        setSelectedAddressId(address.id);
                        setFormData((current) => ({ ...current, ...deliveryFromCustomerAddress(address) }));
                      }}
                    />
                    <span>
                      <strong>{address.label || 'Saved address'}</strong>
                      {address.isDefault ? ' · Default' : ''}
                      <span className="muted" style={{ display: 'block', fontSize: '12px' }}>
                        {address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city} {address.pincode}
                      </span>
                    </span>
                  </label>
                ))}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="radio" name="saved-address" checked={selectedAddressId === 'new'} onChange={() => setSelectedAddressId('new')} />
                  Use a different address
                </label>
              </div>
            )}
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
              <AddressFields value={formData} onChange={updateAddress} fields={['phone', 'address', 'apartment', 'landmark', 'city', 'pin', 'state']} />

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
            {profile && (
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={saveThisAddress} onChange={(event) => setSaveThisAddress(event.target.checked)} />
                  Save this address to my account
                </label>
                {saveThisAddress && (
                  <label style={{ marginTop: '10px', display: 'block' }}>
                    Address nickname
                    <input name="addressLabel" value={addressLabel} placeholder="Home / Office" onChange={(event) => setAddressLabel(event.target.value)} />
                  </label>
                )}
              </div>
            )}

            <h3>Delivery method</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="radio" checked readOnly name="delivery" /> Standard delivery · dispatched within 2
              business days, delivered in 5–7 business days
            </label>

            <h3>Payment method</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="radio" name="payment" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} />
              Pay online (Razorpay)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input type="radio" name="payment" checked={paymentMethod === 'whatsapp'} onChange={() => setPaymentMethod('whatsapp')} />
              Complete on WhatsApp
            </label>

            {checkoutError && <p className="coupon-feedback error" role="alert">{checkoutError}</p>}
            {checkoutError && <p><Link className="text-link" href={buyNowProduct ? `/product/${buyNowProduct.id}` : '/cart'}>{buyNowProduct ? 'Review this saree' : 'Review your bag'}</Link></p>}
            {submitError && <p className="coupon-feedback error" role="alert">{submitError}</p>}
            {paymentMethod === 'whatsapp' && (
              <p className="muted" style={{ fontSize: '12px', marginTop: '10px' }}>
                Your order is saved first, then WhatsApp opens with your order ID so we can confirm payment and delivery.
              </p>
            )}
            <button className="btn" type="submit" disabled={isSubmitting || !!checkoutError} style={{ width: '100%', marginTop: '24px' }}>
              {isSubmitting
                ? 'Placing order…'
                : paymentMethod === 'online'
                  ? <>Place order &amp; pay <Icon name="arrow-up-right" /></>
                  : <><Icon name="whatsapp" /> Place order on WhatsApp</>}
            </button>
            {paymentMethod === 'online' && (
              <>
                <div className="checkout-or-divider" aria-hidden="true">
                  <span>or</span>
                </div>
                {/* Same form submit as above, with the WhatsApp payment method. */}
                <button
                  type="submit"
                  data-payment="whatsapp"
                  className="whatsapp-order"
                  style={{ width: '100%', minHeight: '48px', justifyContent: 'center' }}
                  disabled={isSubmitting || !!checkoutError}
                >
                  <Icon name="whatsapp" /> Order on WhatsApp instead
                </button>
              </>
            )}
          </form>

          <aside className="summary-box">
            <h2>Your order</h2>
            <div className="order-summary-items">
              {checkoutQuote.items.map((x) => {
                const p = getProductById(x.id);
                const lineImage = resolveOrderLineImage(x, p);
                const variantName = x.variant || x.colour;
                return (
                  <div key={x.id} className="order-summary-item">
                    <div className="order-summary-thumb">
                      <ProductThumb
                        src={lineImage}
                        alt={x.name}
                        sizes="64px"
                      />
                    </div>
                    <div className="order-summary-details">
                      <span className="order-summary-name">
                        {x.name} × {x.qty}
                      </span>
                      {variantName && (
                        <span className="order-summary-meta muted">
                          {capitalizeColour(variantName)}
                        </span>
                      )}
                    </div>
                    <OrderLinePrice item={x} />
                  </div>
                );
              })}
            </div>
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
