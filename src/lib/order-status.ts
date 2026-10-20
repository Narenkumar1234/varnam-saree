import type { OrderPayment } from '@/types';

export type PaymentDisplayStatus = 'paid' | 'authorized' | 'unpaid';

export function paymentDisplayStatus(payment?: OrderPayment | null): PaymentDisplayStatus {
  if (payment?.status === 'paid') return 'paid';
  if (payment?.status === 'authorized') return 'authorized';
  return 'unpaid';
}

/** Admin-facing payment snapshot label. Fulfilment status stays in the existing dropdown. */
export function orderPaymentLabel(payment?: OrderPayment | null): string {
  const state = paymentDisplayStatus(payment);
  if (state === 'paid') return 'Paid';
  if (state === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}

/**
 * Customer-facing order status. DB fulfilment values are unchanged; unpaid
 * Razorpay checkouts stay "Confirmed" in storage until an admin updates them.
 */
export function customerFacingOrderStatus(status?: string | null, payment?: OrderPayment | null): string {
  const fulfilment = (typeof status === 'string' && status.trim()) || 'Confirmed';
  if (fulfilment.toLowerCase() === 'cancelled') return fulfilment;
  const state = paymentDisplayStatus(payment);
  if (state === 'paid') return fulfilment;
  if (state === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}
