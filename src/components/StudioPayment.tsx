'use client';

import { useEffect, useRef, useState } from 'react';
import { money } from '@/data/products';
import type { OrderPayment } from '@/types';

interface PaymentProof {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface CheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (proof: PaymentProof) => void;
  modal: { ondismiss: () => void };
  config?: any;
}
declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => {
      open: () => void;
      on: (event: 'payment.failed', handler: () => void) => void;
    };
  }
}

let checkoutScript: Promise<void> | undefined;
export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScript) return checkoutScript;
  checkoutScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      checkoutScript = undefined;
      reject(new Error('Razorpay could not load. Please retry or use WhatsApp.'));
    };
    const timeout = window.setTimeout(fail, 15000);
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      if (!window.Razorpay) return fail();
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return checkoutScript;
}

async function paymentRequest(endpoint: string, body: unknown) {
  const response = await fetch(`/api/payments/razorpay/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Payment could not be completed. Please contact Varnam on WhatsApp.');
  return result;
}

interface Props {
  orderId: string;
  total: number;
  customerName: string;
  email: string;
  phone?: string | null;
  cancelled: boolean;
  payment?: OrderPayment;
  onPaid: () => void;
}

export function StudioPayment({ orderId, total, customerName, email, phone, cancelled, payment, onPaid }: Props) {
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(payment?.status === 'paid');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(payment?.status === 'authorized');
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const storageKey = `varnam-payment-proof:${orderId}`;

  useEffect(() => {
    if (payment?.status === 'paid') {
      setPaid(true);
      try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved.razorpay_order_id === 'string' && typeof saved.razorpay_payment_id === 'string' && typeof saved.razorpay_signature === 'string') setProof(saved);
    } catch { /* A blocked or malformed cache must not prevent ordering. */ }
  }, [payment?.status, storageKey]);

  function finish() { inFlight.current = false; setBusy(false); }

  async function verify(receipt: PaymentProof) {
    // Keep the receipt across reloads so a failed verification request never
    // asks the customer to pay again. This contains no API secret or card data.
    setProof(receipt);
    try { sessionStorage.setItem(storageKey, JSON.stringify(receipt)); } catch { /* The in-memory retry remains available. */ }
    setMessage('Verifying your payment…');
    setError(false);
    try {
      const result = await paymentRequest('verify', { orderId, ...receipt });
      if (result.status === 'paid') {
        setPaid(true);
        setProof(null);
        try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
        setMessage('Payment verified. Thank you.');
        onPaid();
      } else {
        setAwaitingConfirmation(true);
        setMessage('Payment received and awaiting capture. Retry verification shortly; please do not pay again.');
      }
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : 'Verification is pending. Retry verification or contact Varnam on WhatsApp before paying again.');
    } finally { finish(); }
  }

  async function pay() {
    if (inFlight.current || paid) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    setMessage('');
    if (proof) return verify(proof);
    try {
      const result = await paymentRequest('order', { orderId });
      if (result.status === 'paid') {
        setPaid(true);
        finish();
        onPaid();
        return;
      }
      if (result.status === 'processing') {
        setAwaitingConfirmation(true);
        setMessage('Payment is being confirmed. Check payment status shortly or contact Varnam on WhatsApp; please do not pay again.');
        finish();
        return;
      }
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error('Razorpay is unavailable. Please use WhatsApp.');
      let submitted = false;
      const checkout = new window.Razorpay({
        key: result.keyId, order_id: result.orderId, amount: result.amount, currency: result.currency,
        name: 'Varnam Saree', description: `Order ${orderId}`,
        prefill: { name: customerName, email, contact: phone || '' },
        theme: { color: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#392535' },
        handler: (receipt) => { submitted = true; void verify(receipt); },
        modal: { ondismiss: () => {
          if (submitted) return;
          setMessage('Payment window closed. You can retry or order on WhatsApp. If debited, check payment status before retrying.');
          finish();
        } },
      });
      checkout.on('payment.failed', () => {
        setError(true);
        setMessage('Payment failed. You can retry in Checkout or close it and use WhatsApp.');
      });
      checkout.open();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : 'Unable to start payment. Please use WhatsApp.');
      finish();
    }
  }

  return <div className="studio-payment">
    {paid ? <div className="studio-payment-paid" role="status">Paid · Razorpay{payment?.paymentId && <small>{payment.paymentId}</small>}</div> : <>
      <button type="button" className="studio-payment-button" disabled={busy || (cancelled && !proof)} onClick={() => void pay()}>
        {busy ? 'Please wait…' : proof ? 'Retry payment verification' : awaitingConfirmation ? 'Check payment status' : `Pay ${money(total)} with Razorpay`}
      </button>
      {cancelled && !proof && <small>Online payment is unavailable for cancelled orders.</small>}
      {message && <div className={error ? 'studio-payment-message error' : 'studio-payment-message'} role={error ? 'alert' : 'status'}>{message}</div>}
    </>}
  </div>;
}
