'use client';

import { useEffect, useRef, useState } from 'react';
import { loadRazorpayCheckout } from '@/components/StudioPayment';
import { money } from '@/data/products';
import type { OrderPayment } from '@/types';

interface PaymentProof {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

async function paymentRequest(endpoint: string, body: unknown) {
  const response = await fetch(`/api/payments/razorpay/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Payment could not be completed. Please try WhatsApp.');
  return result;
}

interface Props {
  orderId: string;
  total: number;
  customerName: string;
  email?: string;
  phone?: string;
  payment?: Pick<OrderPayment, 'status'> & Partial<OrderPayment>;
  /** Immediately open the Razorpay modal after mount. */
  autoStart?: boolean;
  whatsAppUrl?: string | null;
  onPaid?: () => void;
  /** Idle unpaid button label. Checkout keeps the default “Pay ₹… online”. */
  idleLabel?: string;
}

export function CustomerPayment({ orderId, total, customerName, email, phone, payment, autoStart, whatsAppUrl, onPaid, idleLabel }: Props) {
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(payment?.status === 'paid');
  const [processing, setProcessing] = useState(payment?.status === 'authorized');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const inFlight = useRef(false);
  const autoStarted = useRef(false);
  const storageKey = `varnam-payment-proof:${orderId}`;

  useEffect(() => {
    if (payment?.status === 'paid') { setPaid(true); return; }
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved?.razorpay_order_id && saved?.razorpay_payment_id && saved?.razorpay_signature) setProof(saved);
    } catch { /* Storage is optional. */ }
  }, [payment?.status, storageKey]);

  useEffect(() => {
    if (autoStart && !autoStarted.current && !paid && !processing) {
      autoStarted.current = true;
      void pay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  function finish() { inFlight.current = false; setBusy(false); }

  async function verify(receipt: PaymentProof) {
    setProof(receipt);
    try { sessionStorage.setItem(storageKey, JSON.stringify(receipt)); } catch { /* Optional. */ }
    setMessage('Verifying payment…');
    setIsError(false);
    try {
      const result = await paymentRequest('verify', { orderId, ...receipt });
      if (result.status === 'paid') {
        setPaid(true);
        setProof(null);
        try { sessionStorage.removeItem(storageKey); } catch { /* Optional. */ }
        setMessage('Payment confirmed — thank you!');
        onPaid?.();
      } else {
        setProcessing(true);
        setMessage('Payment received, awaiting confirmation. Please do not pay again.');
      }
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Verification pending. Please do not pay again.');
    } finally { finish(); }
  }

  async function pay() {
    if (inFlight.current || paid) return;
    inFlight.current = true;
    setBusy(true);
    setIsError(false);
    setMessage('');
    if (proof) return verify(proof);
    try {
      setMessage('Starting payment…');
      const result = await paymentRequest('order', { orderId });
      if (result.status === 'paid') {
        setPaid(true);
        setMessage('This order is already paid.');
        finish();
        onPaid?.();
        return;
      }
      if (result.status === 'processing') {
        setProcessing(true);
        setMessage('Payment is being confirmed. Please do not pay again.');
        finish();
        return;
      }
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error('Razorpay is unavailable. Please complete your order on WhatsApp.');
      setMessage('');
      let submitted = false;
      const checkout = new window.Razorpay({
        key: result.keyId,
        order_id: result.orderId,
        amount: result.amount,
        currency: result.currency,
        name: 'Varnam Saree',
        description: `Order ${orderId}`,
        prefill: { name: customerName, email: email || '', contact: phone || '' },
        theme: { color: typeof document !== 'undefined' ? (getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#392535') : '#392535' },
        handler: (receipt) => { submitted = true; void verify(receipt); },
        modal: { ondismiss: () => {
          if (submitted) return;
          setMessage('Payment window closed. You can retry or complete your order on WhatsApp.');
          finish();
        } },
      });
      checkout.on('payment.failed', () => {
        setIsError(true);
        setMessage('Payment failed. Retry in the payment window or close it.');
      });
      checkout.open();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Unable to start payment. Please use WhatsApp.');
      finish();
    }
  }

  if (paid) {
    return (
      <div id="customer-payment" style={{ textAlign: 'center', margin: '20px 0' }}>
        <p role="status" style={{ color: 'var(--success, #2e7d32)', fontWeight: 600, fontSize: '1.1rem' }}>✓ Payment confirmed</p>
        {payment?.paymentId && <small className="muted">{payment.paymentId}</small>}
      </div>
    );
  }

  return (
    <div id="customer-payment" style={{ textAlign: 'center', margin: '20px 0' }}>
      <button type="button" className="btn" disabled={busy} onClick={() => void pay()} style={{ width: '100%', maxWidth: '360px' }}>
        {busy ? 'Please wait…' : proof ? 'Retry payment verification' : processing ? 'Check payment status' : (idleLabel || `Pay ${money(total)} online`)}
      </button>
      {message && <p className={`coupon-feedback${isError ? ' error' : ''}`} role={isError ? 'alert' : 'status'} style={{ marginTop: '12px' }}>{message}</p>}
      <div style={{ marginTop: '16px' }}>
        {whatsAppUrl && (
          <p><a className="text-link" href={whatsAppUrl}>Complete on WhatsApp instead</a></p>
        )}
        <p className="muted" style={{ marginTop: '8px', fontSize: '0.85rem' }}>
          Your order is saved. Pay online or arrange payment on WhatsApp.
        </p>
      </div>
    </div>
  );
}
