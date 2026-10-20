import type { OrderPayment } from '@/types';

export type PaymentDisplayStatus = 'paid' | 'authorized' | 'unpaid';
export type PaymentStatusSnapshot = Pick<OrderPayment, 'status'>;

export function paymentDisplayStatus(payment?: PaymentStatusSnapshot | null): PaymentDisplayStatus {
  if (payment?.status === 'paid') return 'paid';
  if (payment?.status === 'authorized') return 'authorized';
  return 'unpaid';
}

/** Public tracking/account payload: payment status only, never Razorpay ids or signatures. */
export function publicPaymentSnapshot(payment?: PaymentStatusSnapshot | null): PaymentStatusSnapshot | undefined {
  if (payment?.status !== 'pending' && payment?.status !== 'authorized' && payment?.status !== 'paid') return undefined;
  return { status: payment.status };
}

/** Step 1 is complete only after a paid, non-cancelled order. */
export function trackingConfirmStepComplete(status?: string | null, payment?: PaymentStatusSnapshot | null): boolean {
  if ((status || '').trim().toLowerCase() === 'cancelled') return false;
  return paymentDisplayStatus(payment) === 'paid';
}

/** Admin-facing payment snapshot label. Fulfilment status stays in the existing dropdown. */
export function orderPaymentLabel(payment?: PaymentStatusSnapshot | null): string {
  const state = paymentDisplayStatus(payment);
  if (state === 'paid') return 'Paid';
  if (state === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}

/**
 * Customer-facing order status. DB fulfilment values are unchanged; unpaid
 * Razorpay checkouts stay "Confirmed" in storage until an admin updates them.
 */
export function customerFacingOrderStatus(status?: string | null, payment?: PaymentStatusSnapshot | null): string {
  const fulfilment = (typeof status === 'string' && status.trim()) || 'Confirmed';
  if (fulfilment.toLowerCase() === 'cancelled') return fulfilment;
  const state = paymentDisplayStatus(payment);
  if (state === 'paid') return fulfilment;
  if (state === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}
