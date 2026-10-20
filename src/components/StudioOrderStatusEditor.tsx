'use client';

import { StudioOfflinePayment } from '@/components/StudioOfflinePayment';
import {
  adminStatusChangeError,
  normalizeOrderStatus,
  orderPaymentLabel,
  paymentDisplayStatus,
} from '@/lib/order-status';
import { STUDIO_ORDER_STATUSES } from '@/lib/studio-order-filters';
import type { OrderPayment } from '@/types';

interface Props {
  orderId: string;
  status?: string | null;
  payment?: OrderPayment;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onUpdated: () => void;
  onStatusChange?: (status: string) => void;
  onError?: (message: string) => void;
}

export function StudioOrderStatusEditor({
  orderId,
  status,
  payment,
  adminFetch,
  onUpdated,
  onStatusChange,
  onError,
}: Props) {
  const normalized = normalizeOrderStatus(status, payment);
  const paymentState = paymentDisplayStatus(payment);

  async function updateStatus(next: string) {
    if (next === normalized) return;
    if (!confirm(`Change order ${orderId} status to ${next}?`)) return;
    try {
      const response = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        onError?.(result.error || 'Failed to update status');
        return;
      }
      onStatusChange?.(next);
    } catch {
      onError?.('Failed to update status');
    }
  }

  return (
    <div className="studio-order-status-editor">
      <select
        className={`admin-status-select status-${normalized.toLowerCase().replace(/\s+/g, '-')}`}
        value={normalized}
        onChange={(event) => { void updateStatus(event.target.value); }}
      >
        {STUDIO_ORDER_STATUSES.map((option) => (
          <option
            key={option}
            value={option}
            disabled={Boolean(adminStatusChangeError(status, option, payment))}
          >
            {option}
          </option>
        ))}
      </select>
      <div className={`admin-payment-label is-${paymentState}`}>{orderPaymentLabel(payment)}</div>
      <StudioOfflinePayment
        orderId={orderId}
        payment={payment}
        status={status}
        adminFetch={adminFetch}
        onUpdated={onUpdated}
      />
    </div>
  );
}
