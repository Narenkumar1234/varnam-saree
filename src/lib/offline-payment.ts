import type { OfflinePaymentMethod, OrderPayment } from '@/types';

export const OFFLINE_PAYMENT_METHODS = ['Cash', 'UPI', 'Bank transfer', 'Other'] as const;
export const OFFLINE_PAYMENT_NOTE_MAX = 200;

export function isOfflinePaymentMethod(value: unknown): value is OfflinePaymentMethod {
  return typeof value === 'string' && (OFFLINE_PAYMENT_METHODS as readonly string[]).includes(value);
}

export function normalizeOfflinePaymentNote(note: unknown): string | null {
  if (note == null || note === '') return '';
  if (typeof note !== 'string') return null;
  const trimmed = note.trim();
  if (trimmed.length > OFFLINE_PAYMENT_NOTE_MAX) return null;
  return trimmed;
}

export function createOfflinePaidPayment(input: {
  method: OfflinePaymentMethod;
  note?: string;
  adminEmail: string;
  paidAt?: string;
}): OrderPayment {
  return {
    provider: 'offline',
    status: 'paid',
    method: input.method,
    ...(input.note ? { note: input.note } : {}),
    paidAt: input.paidAt ?? new Date().toISOString(),
    adminEmail: input.adminEmail,
  };
}

export const UNREADABLE_ORDER_DATA_ERROR = 'Order data could not be read';

export function writePaymentSnapshot(itemsJson: string, payment: OrderPayment | null): string {
  let raw: unknown;
  try {
    raw = JSON.parse(itemsJson);
  } catch {
    throw new Error(UNREADABLE_ORDER_DATA_ERROR);
  }

  let snapshot: Record<string, unknown>;
  if (Array.isArray(raw)) {
    snapshot = { version: 1, items: raw };
  } else if (raw && typeof raw === 'object') {
    snapshot = { ...(raw as Record<string, unknown>) };
  } else {
    throw new Error(UNREADABLE_ORDER_DATA_ERROR);
  }

  if (payment == null) {
    delete snapshot.payment;
    return JSON.stringify(snapshot);
  }
  return JSON.stringify({ ...snapshot, payment });
}

export function cancelledOrderBlocksOffline(status?: string | null): string | null {
  if ((status || '').trim().toLowerCase() === 'cancelled') {
    return 'Cancelled orders cannot be marked as paid.';
  }
  return null;
}

export function offlineMarkPaidBlocked(
  status?: string | null,
  payment?: Pick<OrderPayment, 'provider' | 'status'> | null,
): string | null {
  const cancelled = cancelledOrderBlocksOffline(status);
  if (cancelled) return cancelled;
  if ((status || '').trim().toLowerCase() === 'delivered') {
    return 'Delivered orders cannot be marked as paid offline.';
  }
  const razorpay = razorpayPaidBlocksOffline(payment);
  if (razorpay) return razorpay;
  if (payment?.status === 'paid') {
    return 'Only payment-pending orders can be marked as paid offline.';
  }
  return null;
}

export function offlineMarkUnpaidBlocked(
  status?: string | null,
  payment?: Pick<OrderPayment, 'provider' | 'status'> | null,
): string | null {
  const required = offlinePaidRequiredToUndo(payment);
  if (required) return required;
  if ((status || '').trim().toLowerCase() === 'cancelled') {
    return 'Cancelled orders cannot be marked unpaid.';
  }
  if ((status || '').trim().toLowerCase() === 'delivered') {
    return 'Only confirmed offline-paid orders can be marked unpaid.';
  }
  return null;
}

export function razorpayPaidBlocksOffline(payment?: Pick<OrderPayment, 'provider' | 'status'> | null): string | null {
  if (payment?.provider === 'razorpay' && payment.status === 'paid') {
    return 'This order is already paid online and cannot be marked as offline paid.';
  }
  return null;
}

export function offlinePaidRequiredToUndo(payment?: Pick<OrderPayment, 'provider' | 'status'> | null): string | null {
  if (payment?.provider !== 'offline' || payment.status !== 'paid') {
    return 'Only offline payments can be marked unpaid.';
  }
  return null;
}

export function isRazorpayPaid(payment?: Pick<OrderPayment, 'provider' | 'status'> | null): boolean {
  return payment?.provider === 'razorpay' && payment.status === 'paid';
}

export function isOfflinePaid(payment?: Pick<OrderPayment, 'provider' | 'status'> | null): boolean {
  return payment?.provider === 'offline' && payment.status === 'paid';
}

export function studioPaidLabel(payment?: OrderPayment | null): string | null {
  if (payment?.status !== 'paid') return null;
  if (payment.provider === 'offline') {
    return payment.method ? `Paid · Offline (${payment.method})` : 'Paid · Offline';
  }
  return 'Paid · Razorpay';
}

export function offlineTelegramPaymentStatus(method: OfflinePaymentMethod): `paid (offline ${OfflinePaymentMethod})` {
  return `paid (offline ${method})`;
}
