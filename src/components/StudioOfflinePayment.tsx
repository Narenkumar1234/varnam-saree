'use client';

import { useState } from 'react';
import type { OfflinePaymentMethod, OrderPayment } from '@/types';
import {
  OFFLINE_PAYMENT_METHODS,
  isOfflinePaid,
  isRazorpayPaid,
  studioPaidLabel,
} from '@/lib/offline-payment';

interface Props {
  orderId: string;
  payment?: OrderPayment;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onUpdated: () => void;
}

export function StudioOfflinePayment({ orderId, payment, adminFetch, onUpdated }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [method, setMethod] = useState<OfflinePaymentMethod>('Cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const paidLabel = studioPaidLabel(payment);

  async function save(paymentBody: { action: 'mark-offline-paid'; method: OfflinePaymentMethod; note?: string } | { action: 'mark-unpaid' }) {
    setBusy(true);
    setError(false);
    setMessage('');
    try {
      const response = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment: paymentBody }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to update payment.');
      setConfirming(false);
      setNote('');
      onUpdated();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : 'Unable to update payment.');
    } finally {
      setBusy(false);
    }
  }

  if (isRazorpayPaid(payment)) {
    return (
      <div className="studio-offline-payment">
        <div className="studio-payment-paid" role="status">
          {paidLabel}
          {payment?.paymentId && <small>{payment.paymentId}</small>}
        </div>
      </div>
    );
  }

  if (isOfflinePaid(payment)) {
    return (
      <div className="studio-offline-payment">
        <div className="studio-payment-paid" role="status">
          {paidLabel}
          {payment?.note && <small>{payment.note}</small>}
        </div>
        <button
          type="button"
          className="btn outline studio-offline-undo"
          disabled={busy}
          onClick={() => {
            if (!confirm('Mark this offline payment as unpaid?')) return;
            void save({ action: 'mark-unpaid' });
          }}
        >
          {busy ? 'Please wait…' : 'Mark unpaid'}
        </button>
        {message && <div className={error ? 'studio-payment-message error' : 'studio-payment-message'} role={error ? 'alert' : 'status'}>{message}</div>}
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="studio-offline-payment">
        <button type="button" className="studio-offline-mark" onClick={() => { setConfirming(true); setMessage(''); setError(false); }}>
          Mark as paid (offline)
        </button>
      </div>
    );
  }

  return (
    <form
      className="studio-offline-payment studio-offline-confirm"
      onSubmit={(event) => {
        event.preventDefault();
        void save({ action: 'mark-offline-paid', method, note: note.trim() || undefined });
      }}
    >
      <label>
        Method
        <select value={method} onChange={(event) => setMethod(event.target.value as OfflinePaymentMethod)} disabled={busy}>
          {OFFLINE_PAYMENT_METHODS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        Reference / note (optional)
        <input
          type="text"
          maxLength={200}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="UPI ref, cheque no…"
          disabled={busy}
        />
      </label>
      <div className="studio-offline-actions">
        <button type="submit" className="studio-offline-mark" disabled={busy}>
          {busy ? 'Saving…' : 'Confirm paid'}
        </button>
        <button type="button" className="btn outline" disabled={busy} onClick={() => { setConfirming(false); setMessage(''); }}>
          Cancel
        </button>
      </div>
      {message && <div className={error ? 'studio-payment-message error' : 'studio-payment-message'} role={error ? 'alert' : 'status'}>{message}</div>}
    </form>
  );
}
