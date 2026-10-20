import type { Order, OrderItem, OrderPayment, OrderPricing, Product } from '@/types';
import { readOrderSnapshot } from '@/lib/pricing';
import { paymentDisplayStatus, publicPaymentSnapshot, type PaymentStatusSnapshot } from '@/lib/order-status';
import { getCartLineImage } from '@/lib/product-gallery';

export type TrackedOrder = Pick<Order, 'id' | 'total'> & {
  items?: OrderItem[];
  pricing?: OrderPricing;
  date?: string;
  createdAt?: string;
  status?: string;
  payment?: PaymentStatusSnapshot;
};

export interface TrackableOrderRecord {
  id: string;
  total: number;
  items?: OrderItem[];
  pricing?: OrderPricing;
  date?: string;
  createdAt?: string | Date | null;
  status?: string | null;
  payment?: PaymentStatusSnapshot | Pick<OrderPayment, 'status'> | null;
  itemsJson?: string | null;
}

function publicCreatedAt(value: TrackableOrderRecord['createdAt']): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

/** Fill a thumbnail for each line from the live catalogue when the stored order has none (older orders). */
export function withLineImages(items: OrderItem[], catalogue?: Product[]): OrderItem[] {
  return items.map((item) => {
    if (item.image || !catalogue) return item;
    const product = catalogue.find((entry) => entry.id === item.id);
    if (!product) return item;
    return { ...item, image: getCartLineImage(product, item.variant || item.colour || 0) };
  });
}

/** Line items for the public tracking page: display fields only. */
function publicOrderItems(items: OrderItem[], catalogue?: Product[]): OrderItem[] {
  return withLineImages(items, catalogue).map((item) => ({
    id: item.id,
    qty: item.qty,
    ...(typeof item.name === 'string' ? { name: item.name } : {}),
    ...(typeof item.variant === 'string' ? { variant: item.variant } : {}),
    ...(typeof item.colour === 'string' ? { colour: item.colour } : {}),
    ...(typeof item.image === 'string' ? { image: item.image } : {}),
    ...(typeof item.unitPrice === 'number' ? { unitPrice: item.unitPrice } : {}),
    ...(typeof item.subtotal === 'number' ? { subtotal: item.subtotal } : {}),
    ...(typeof item.discountAmount === 'number' ? { discountAmount: item.discountAmount } : {}),
    ...(typeof item.total === 'number' ? { total: item.total } : {}),
  }));
}

/** True when some stored line has no thumbnail yet (orders placed before thumbnails were saved). */
export function trackedOrderNeedsCatalogue(order: TrackableOrderRecord): boolean {
  const items = typeof order.itemsJson === 'string' ? readOrderSnapshot(order.itemsJson).items : order.items;
  return Boolean(items?.some((item) => !item.image));
}

/** Public tracking payload: fulfilment status + payment status, no Razorpay secrets. */
export function toPublicTrackedOrder(order: TrackableOrderRecord, catalogue?: Product[]): TrackedOrder {
  const snapshot = typeof order.itemsJson === 'string'
    ? readOrderSnapshot(order.itemsJson)
    : { items: order.items, pricing: order.pricing, payment: order.payment };
  const createdAt = publicCreatedAt(order.createdAt);
  const payment = publicPaymentSnapshot(snapshot.payment || order.payment);
  const tracked: TrackedOrder = { id: order.id, total: order.total };
  const items = snapshot.items || order.items;
  if (items && items.length > 0) tracked.items = publicOrderItems(items, catalogue);
  if (snapshot.pricing || order.pricing) tracked.pricing = snapshot.pricing || order.pricing;
  if (typeof order.date === 'string' && order.date) tracked.date = order.date;
  if (createdAt) tracked.createdAt = createdAt;
  if (typeof order.status === 'string' && order.status.trim()) tracked.status = order.status;
  if (payment) tracked.payment = payment;
  return tracked;
}

/** Prefer a completed server lookup; keep a same-browser checkout snapshot only as placeholder/fallback. */
export function resolveDisplayedTrackedOrder<T>(
  currentLookup: { status?: string; order?: T } | null | undefined,
  localOrder?: T | null,
): T | undefined {
  return currentLookup?.status === 'found' ? currentLookup.order : localOrder ?? undefined;
}

/** Local Razorpay onPaid is only for unpaid checkouts — never overwrite an already-paid server snapshot. */
export function shouldUpdateLocalOrderPayment(
  localOrder: unknown,
  payment?: PaymentStatusSnapshot | null,
): boolean {
  return Boolean(localOrder) && paymentDisplayStatus(payment) !== 'paid';
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
