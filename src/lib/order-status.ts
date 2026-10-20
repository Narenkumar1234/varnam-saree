import type { OrderPayment } from '@/types';
import { isOfflinePaymentMethod } from '@/lib/offline-payment';

export type PaymentDisplayStatus = 'paid' | 'authorized' | 'unpaid';
export type PaymentStatusSnapshot = Pick<OrderPayment, 'status'> &
  Partial<Pick<OrderPayment, 'provider' | 'method'>>;

export function isCancelledOrderStatus(status?: string | null): boolean {
  return (status || '').trim().toLowerCase() === 'cancelled';
}

export function paymentDisplayStatus(payment?: PaymentStatusSnapshot | null): PaymentDisplayStatus {
  // Offline Studio captures and Razorpay captures both store status "paid".
  if (payment?.status === 'paid') return 'paid';
  if (payment?.status === 'authorized') return 'authorized';
  return 'unpaid';
}

/** Public tracking/account payload: status plus offline method, never Razorpay ids, notes, or admin email. */
export function publicPaymentSnapshot(payment?: PaymentStatusSnapshot | null): PaymentStatusSnapshot | undefined {
  if (payment?.status !== 'pending' && payment?.status !== 'authorized' && payment?.status !== 'paid') return undefined;
  const snapshot: PaymentStatusSnapshot = { status: payment.status };
  if (payment.provider === 'razorpay' || payment.provider === 'offline') snapshot.provider = payment.provider;
  if (payment.provider === 'offline' && isOfflinePaymentMethod(payment.method)) snapshot.method = payment.method;
  return snapshot;
}

/** Step 1 is complete only after a paid, non-cancelled order. */
export function trackingConfirmStepComplete(status?: string | null, payment?: PaymentStatusSnapshot | null): boolean {
  if (isCancelledOrderStatus(status)) return false;
  return paymentDisplayStatus(payment) === 'paid';
}

/** Admin-facing payment snapshot label. Fulfilment status stays in the existing dropdown. */
export function orderPaymentLabel(payment?: PaymentStatusSnapshot | null): string {
  const state = paymentDisplayStatus(payment);
  if (state === 'paid') return 'Paid';
  if (state === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}

/** Customer-facing payment label, including the offline method when Studio recorded one. */
export function customerPaymentLabel(payment?: PaymentStatusSnapshot | null): string {
  const state = paymentDisplayStatus(payment);
  if (state === 'authorized') return 'Payment processing';
  if (state !== 'paid') return 'Awaiting payment';
  if (payment?.provider === 'offline') {
    return payment.method ? `Paid · Offline (${payment.method})` : 'Paid · Offline';
  }
  return 'Paid';
}

/**
 * Customer-facing order status. DB fulfilment values are unchanged; unpaid
 * Razorpay checkouts stay "Confirmed" in storage until an admin updates them.
 */
export function customerFacingOrderStatus(status?: string | null, payment?: PaymentStatusSnapshot | null): string {
  const fulfilment = (typeof status === 'string' && status.trim()) || 'Confirmed';
  if (isCancelledOrderStatus(fulfilment)) return fulfilment;
  const state = paymentDisplayStatus(payment);
  if (state === 'paid') return fulfilment;
  if (state === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}

/** Account/order-history line: fulfilment plus a payment label when they differ. */
export function accountOrderStatusLine(status?: string | null, payment?: PaymentStatusSnapshot | null): string {
  const facing = customerFacingOrderStatus(status, payment);
  if (isCancelledOrderStatus(facing)) return facing;
  const paymentLabel = customerPaymentLabel(payment);
  if (facing === paymentLabel) return facing;
  return `${facing} · ${paymentLabel}`;
}
