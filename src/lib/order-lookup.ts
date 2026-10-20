import type { Order, OrderPayment, OrderPricing } from '@/types';
import { readOrderSnapshot } from '@/lib/pricing';
import { publicPaymentSnapshot, type PaymentStatusSnapshot } from '@/lib/order-status';

export type TrackedOrder = Pick<Order, 'id' | 'total'> & {
  pricing?: OrderPricing;
  date?: string;
  createdAt?: string;
  status?: string;
  payment?: PaymentStatusSnapshot;
};

export interface TrackableOrderRecord {
  id: string;
  total: number;
  pricing?: OrderPricing;
  date?: string;
  createdAt?: string | Date | null;
  status?: string | null;
  payment?: Pick<OrderPayment, 'status'> | null;
  itemsJson?: string | null;
}

function publicCreatedAt(value: TrackableOrderRecord['createdAt']): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

/** Public tracking payload: fulfilment status + payment status, no Razorpay secrets. */
export function toPublicTrackedOrder(order: TrackableOrderRecord): TrackedOrder {
  const snapshot = typeof order.itemsJson === 'string'
    ? readOrderSnapshot(order.itemsJson)
    : { pricing: order.pricing, payment: order.payment };
  const createdAt = publicCreatedAt(order.createdAt);
  const payment = publicPaymentSnapshot(snapshot.payment || order.payment);
  const tracked: TrackedOrder = { id: order.id, total: order.total };
  if (snapshot.pricing || order.pricing) tracked.pricing = snapshot.pricing || order.pricing;
  if (typeof order.date === 'string' && order.date) tracked.date = order.date;
  if (createdAt) tracked.createdAt = createdAt;
  if (typeof order.status === 'string' && order.status.trim()) tracked.status = order.status;
  if (payment) tracked.payment = payment;
  return tracked;
}

// Only a confirmed 404 means "not found". Transport, server, and malformed
// responses are retryable failures and must never become a missing-order result.
export async function loadTrackedOrder(id: string, signal?: AbortSignal): Promise<TrackedOrder | null> {
  const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { signal, cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Order lookup failed.');
  const data = await response.json();
  if (!data?.order || data.order.id !== id || typeof data.order.total !== 'number' || !Number.isFinite(data.order.total)) throw new Error('Invalid order lookup response.');
  return toPublicTrackedOrder(data.order);
}
