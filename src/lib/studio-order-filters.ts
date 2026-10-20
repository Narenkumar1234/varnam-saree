import {
  isCancelledOrderStatus,
  normalizeOrderStatus,
  orderPaymentLabel,
  paymentDisplayStatus,
  type OrderStatus,
  type PaymentStatusSnapshot,
} from '@/lib/order-status';

export const STUDIO_ORDER_STATUSES = [
  'Payment pending',
  'Confirmed',
  'Delivered',
  'Cancelled',
] as const;

export type StudioOrderStatus = (typeof STUDIO_ORDER_STATUSES)[number];

export const STUDIO_ORDER_FILTER_TABS = ['Ordered', ...STUDIO_ORDER_STATUSES] as const;
export type StudioOrderFilterTab = (typeof STUDIO_ORDER_FILTER_TABS)[number];

export interface StudioOrderFilterable {
  id: string;
  customerName: string;
  email: string;
  phone?: string | null;
  status?: string | null;
  payment?: PaymentStatusSnapshot | null;
  total?: number | null;
}

export interface StudioOrderFilters {
  status: StudioOrderFilterTab;
  query: string;
}

export function createStudioOrderFilters(): StudioOrderFilters {
  return { status: 'Ordered', query: '' };
}

export function hasActiveStudioOrderFilters(filters: StudioOrderFilters): boolean {
  return filters.status !== 'Ordered' || filters.query.trim() !== '';
}

/** Empty / legacy statuses follow the same payment-aware normalisation as Studio. */
export function normalizeStudioOrderStatus(
  status?: string | null,
  payment?: PaymentStatusSnapshot | null,
): OrderStatus {
  return normalizeOrderStatus(status, payment);
}

export function studioOrderPaymentLabel(
  payment?: StudioOrderFilterable['payment']
): 'Paid' | 'Awaiting payment' | 'Payment processing' {
  return orderPaymentLabel(payment) as 'Paid' | 'Awaiting payment' | 'Payment processing';
}

function matchesStudioOrderQuery(order: StudioOrderFilterable, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const fields = [order.id, order.customerName, order.phone ?? '', order.email];
  return fields.some((field) => field.toLowerCase().includes(needle));
}

export function filterStudioOrders<T extends StudioOrderFilterable>(
  orders: T[],
  filters: StudioOrderFilters
): T[] {
  return orders.filter((order) => {
    const status = normalizeStudioOrderStatus(order.status, order.payment);
    if (filters.status !== 'Ordered' && status !== filters.status) return false;
    return matchesStudioOrderQuery(order, filters.query);
  });
}

export function countStudioOrdersByStatus(
  orders: StudioOrderFilterable[]
): Record<StudioOrderFilterTab, number> {
  const counts = {
    Ordered: orders.length,
    'Payment pending': 0,
    Confirmed: 0,
    Delivered: 0,
    Cancelled: 0,
  } satisfies Record<StudioOrderFilterTab, number>;

  for (const order of orders) {
    const status = normalizeStudioOrderStatus(order.status, order.payment);
    counts[status] += 1;
  }

  return counts;
}

/** Revenue tile: Razorpay or offline paid, excluding cancelled orders. */
export function studioOrderCountsTowardRevenue(order: Pick<StudioOrderFilterable, 'status' | 'payment'>): boolean {
  if (isCancelledOrderStatus(order.status)) return false;
  return paymentDisplayStatus(order.payment) === 'paid';
}

export function sumStudioPaidRevenue(orders: Array<Pick<StudioOrderFilterable, 'status' | 'payment' | 'total'>>): number {
  return orders.reduce((sum, order) => {
    if (!studioOrderCountsTowardRevenue(order)) return sum;
    const total = order.total;
    return sum + (typeof total === 'number' && Number.isFinite(total) ? total : 0);
  }, 0);
}

export function studioOrderLineLabel(
  item: { id: number; name?: string | null },
  product?: { name?: string | null } | null,
): string {
  const named = typeof item.name === 'string' ? item.name.trim() : '';
  if (named) return named;
  const productName = typeof product?.name === 'string' ? product.name.trim() : '';
  if (productName) return productName;
  return `Product #${item.id}`;
}
