import { isCancelledOrderStatus, orderPaymentLabel, paymentDisplayStatus, type PaymentStatusSnapshot } from '@/lib/order-status';

export const STUDIO_ORDER_STATUSES = [
  'Confirmed',
  'Handloom Finishing',
  'Dispatched',
  'Delivered',
  'Cancelled',
] as const;

export type StudioOrderStatus = (typeof STUDIO_ORDER_STATUSES)[number];

export const STUDIO_PAYMENT_FILTERS = [
  'All',
  'Paid',
  'Awaiting payment',
  'Payment processing',
] as const;

export type StudioPaymentFilter = (typeof STUDIO_PAYMENT_FILTERS)[number];

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
  status: 'All' | StudioOrderStatus;
  payment: StudioPaymentFilter;
  query: string;
}

export function createStudioOrderFilters(): StudioOrderFilters {
  return { status: 'All', payment: 'All', query: '' };
}

export function hasActiveStudioOrderFilters(filters: StudioOrderFilters): boolean {
  return filters.status !== 'All' || filters.payment !== 'All' || filters.query.trim() !== '';
}

/** Empty or missing status is treated as Confirmed, matching the Studio dropdown. */
export function normalizeStudioOrderStatus(status?: string | null): string {
  const value = status?.trim();
  return value || 'Confirmed';
}

export function studioOrderPaymentLabel(
  payment?: StudioOrderFilterable['payment']
): Exclude<StudioPaymentFilter, 'All'> {
  return orderPaymentLabel(payment) as Exclude<StudioPaymentFilter, 'All'>;
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
    const status = normalizeStudioOrderStatus(order.status);
    if (filters.status !== 'All' && status !== filters.status) return false;
    if (filters.payment !== 'All' && studioOrderPaymentLabel(order.payment) !== filters.payment) return false;
    return matchesStudioOrderQuery(order, filters.query);
  });
}

export function countStudioOrdersByStatus(
  orders: StudioOrderFilterable[]
): Record<'All' | StudioOrderStatus, number> {
  const counts = {
    All: orders.length,
    Confirmed: 0,
    'Handloom Finishing': 0,
    Dispatched: 0,
    Delivered: 0,
    Cancelled: 0,
  } satisfies Record<'All' | StudioOrderStatus, number>;

  for (const order of orders) {
    const status = normalizeStudioOrderStatus(order.status);
    if (status in counts && status !== 'All') {
      counts[status as StudioOrderStatus] += 1;
    }
  }

  return counts;
}

export function countStudioOrdersByPayment(
  orders: StudioOrderFilterable[]
): Record<StudioPaymentFilter, number> {
  const counts = {
    All: orders.length,
    Paid: 0,
    'Awaiting payment': 0,
    'Payment processing': 0,
  } satisfies Record<StudioPaymentFilter, number>;

  for (const order of orders) {
    counts[studioOrderPaymentLabel(order.payment)] += 1;
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
