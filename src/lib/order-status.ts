import type { OrderPayment } from '@/types';

export type PaymentDisplayStatus = 'Paid' | 'Awaiting payment' | 'Payment processing';

/** Studio and customer UIs share these labels for Razorpay payment state. */
export function paymentDisplayStatus(
  payment?: Pick<OrderPayment, 'status'> | { status?: string | null } | null
): PaymentDisplayStatus {
  if (payment?.status === 'paid') return 'Paid';
  if (payment?.status === 'authorized') return 'Payment processing';
  return 'Awaiting payment';
}
