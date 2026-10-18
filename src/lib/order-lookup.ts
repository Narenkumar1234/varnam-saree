import type { Order } from '@/types';

export type TrackedOrder = Pick<Order, 'id' | 'total' | 'pricing'> & { date?: string; createdAt?: string };

// Only a confirmed 404 means "not found". Transport, server, and malformed
// responses are retryable failures and must never become a missing-order result.
export async function loadTrackedOrder(id: string, signal?: AbortSignal): Promise<TrackedOrder | null> {
  const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { signal, cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Order lookup failed.');
  const data = await response.json();
  if (!data?.order || data.order.id !== id || typeof data.order.total !== 'number' || !Number.isFinite(data.order.total)) throw new Error('Invalid order lookup response.');
  return data.order;
}
