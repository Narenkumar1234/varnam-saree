import type { OrderPayment } from '@/types';

export type PaymentDisplayStatus = 'Paid' | 'Awaiting payment' | 'Payment processing';

/** Studio and customer UIs share these labels for Razorpay and offline payment state. */
export function paymentDisplayStatus(
  payment?: Pick<OrderPayment, 'status'> | { status?: string | null } | null
): PaymentDisplayStatus {
  if (payment?.status === 'paid') return 'Paid';
  if (payment?.status === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}

/** Fulfilment label shown on customer account, orders, and tracking pages. */
export function customerFacingOrderStatus(status?: string | null): string {
  const value = status?.trim();
  return value || 'Confirmed';
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
