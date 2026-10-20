import type { OrderPayment } from '@/types';
import { isOfflinePaymentMethod } from '@/lib/offline-payment';

export const ORDER_STATUSES = ['Payment pending', 'Confirmed', 'Delivered', 'Cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DEFAULT_ORDER_STATUS: OrderStatus = 'Payment pending';

export type PaymentDisplayStatus = 'paid' | 'authorized' | 'unpaid';
export type PaymentStatusSnapshot = Pick<OrderPayment, 'status'> &
  Partial<Pick<OrderPayment, 'provider' | 'method'>>;

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isCancelledOrderStatus(status?: string | null): boolean {
  return (status || '').trim().toLowerCase() === 'cancelled';
}

export function isDeliveredOrderStatus(status?: string | null): boolean {
  return (status || '').trim().toLowerCase() === 'delivered';
}

export function paymentDisplayStatus(payment?: PaymentStatusSnapshot | null): PaymentDisplayStatus {
  // Offline Studio captures and Razorpay captures both store status "paid".
  if (payment?.status === 'paid') return 'paid';
  if (payment?.status === 'authorized') return 'authorized';
  return 'unpaid';
}

export function isPaidPayment(payment?: PaymentStatusSnapshot | null): boolean {
  return paymentDisplayStatus(payment) === 'paid';
}

/** Public tracking/account payload: status plus offline method, never Razorpay ids, notes, or admin email. */
export function publicPaymentSnapshot(payment?: PaymentStatusSnapshot | null): PaymentStatusSnapshot | undefined {
  if (payment?.status !== 'pending' && payment?.status !== 'authorized' && payment?.status !== 'paid') return undefined;
  const snapshot: PaymentStatusSnapshot = { status: payment.status };
  if (payment.provider === 'razorpay' || payment.provider === 'offline') snapshot.provider = payment.provider;
  if (payment.provider === 'offline' && isOfflinePaymentMethod(payment.method)) snapshot.method = payment.method;
  return snapshot;
}

/**
 * Map stored fulfilment values (including legacy Handloom Finishing / Dispatched
 * and empty/'Confirmed'-but-unpaid rows) onto the four Studio statuses.
 * Display-only: does not rewrite the database.
 */
export function normalizeOrderStatus(
  status?: string | null,
  payment?: PaymentStatusSnapshot | null,
): OrderStatus {
  const raw = typeof status === 'string' ? status.trim() : '';
  const lower = raw.toLowerCase();
  if (lower === 'cancelled') return 'Cancelled';
  if (lower === 'delivered') return 'Delivered';
  // Handloom Finishing / Dispatched / empty / Confirmed-but-unpaid / Payment pending
  return isPaidPayment(payment) ? 'Confirmed' : 'Payment pending';
}

/**
 * Status that should be written when payment changes.
 * Delivered and Cancelled are manual and are left alone.
 */
export function deriveOrderStatusFromPayment(
  status?: string | null,
  payment?: PaymentStatusSnapshot | null,
): OrderStatus {
  if (isCancelledOrderStatus(status)) return 'Cancelled';
  if (isDeliveredOrderStatus(status)) return 'Delivered';
  return isPaidPayment(payment) ? 'Confirmed' : 'Payment pending';
}

export function adminStatusChangeError(
  currentStatus: string | null | undefined,
  nextStatus: string,
  payment?: PaymentStatusSnapshot | null,
): string | null {
  if (!isOrderStatus(nextStatus)) {
    return 'Choose Payment pending, Confirmed, Delivered, or Cancelled.';
  }
  const from = normalizeOrderStatus(currentStatus, payment);
  if (from === nextStatus) return null;
  const paid = isPaidPayment(payment);
  if (nextStatus === 'Confirmed' && !paid) {
    return 'Mark the order as paid before setting it to Confirmed.';
  }
  if (nextStatus === 'Payment pending' && paid) {
    return 'Mark the order unpaid before setting it to Payment pending.';
  }
  if (nextStatus === 'Delivered' && (from !== 'Confirmed' || !paid)) {
    return 'Only confirmed (paid) orders can be marked Delivered.';
  }
  return null;
}

export function normalizeOrderLookupId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Step 2 (Confirmed / paid) is complete only after a paid, non-cancelled order. */
export function trackingConfirmStepComplete(status?: string | null, payment?: PaymentStatusSnapshot | null): boolean {
  if (isCancelledOrderStatus(status)) return false;
  return isPaidPayment(payment);
}

export function trackingDeliveredStepComplete(status?: string | null, payment?: PaymentStatusSnapshot | null): boolean {
  return normalizeOrderStatus(status, payment) === 'Delivered';
}

/** Admin-facing payment snapshot label. Fulfilment status stays in the existing dropdown. */
export function orderPaymentLabel(payment?: PaymentStatusSnapshot | null): string {
  const state = paymentDisplayStatus(payment);
  if (state === 'paid') return 'Paid';
  if (state === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}

export function customerPaymentMethodLabel(payment?: PaymentStatusSnapshot | null): string | null {
  if (!isPaidPayment(payment)) return null;
  if (payment?.provider === 'offline') {
    return payment.method ? `Offline (${payment.method})` : 'Offline';
  }
  if (payment?.provider === 'razorpay') return 'Razorpay';
  return null;
}

/** Customer-facing payment label, including the offline method when Studio recorded one. */
export function customerPaymentLabel(payment?: PaymentStatusSnapshot | null): string {
  const state = paymentDisplayStatus(payment);
  if (state === 'authorized') return 'Payment processing';
  if (state !== 'paid') return 'Awaiting payment';
  const method = customerPaymentMethodLabel(payment);
  return method ? `Paid · ${method}` : 'Paid';
}

/**
 * Customer-facing order status. Legacy DB values are normalised; unpaid
 * checkouts (including stored "Confirmed") read as Awaiting payment.
 */
export function customerFacingOrderStatus(status?: string | null, payment?: PaymentStatusSnapshot | null): string {
  const normalized = normalizeOrderStatus(status, payment);
  if (normalized === 'Cancelled') return 'Cancelled';
  if (normalized === 'Delivered') return 'Delivered';
  if (normalized === 'Confirmed') return 'Confirmed';
  if (paymentDisplayStatus(payment) === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}

/** Account / track line: Payment pending → Awaiting payment; Confirmed → Confirmed · Paid · method. */
export function accountOrderStatusLine(status?: string | null, payment?: PaymentStatusSnapshot | null): string {
  const normalized = normalizeOrderStatus(status, payment);
  if (normalized === 'Cancelled') return 'Cancelled';
  if (normalized === 'Delivered') return 'Delivered';
  if (normalized === 'Confirmed') {
    const method = customerPaymentMethodLabel(payment);
    return method ? `Confirmed · Paid · ${method}` : 'Confirmed · Paid';
  }
  if (paymentDisplayStatus(payment) === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}

export function formatOrderCreatedAtIst(value?: string | Date | null): string {
  const date = value instanceof Date ? value : typeof value === 'string' && value.trim() ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
