export const CUSTOMER_RAZORPAY_CONFIG = {
  display: {
    blocks: {
      upi_debit: {
        name: 'Pay via UPI or Debit card',
        instruments: [
          { method: 'upi' },
          { method: 'card', types: ['debit'] },
        ],
      },
    },
    sequence: ['block.upi_debit'],
    preferences: {
      show_default_blocks: false,
    },
    hide: [
      { method: 'netbanking' },
      { method: 'wallet' },
      { method: 'emi' },
      { method: 'cardless_emi' },
      { method: 'paylater' },
    ],
  },
} as const;

export type CustomerRazorpayConfig = typeof CUSTOMER_RAZORPAY_CONFIG;

export interface CustomerRazorpayOptionsInput {
  key?: string;
  keyId?: string;
  order_id?: string;
  orderId?: string;
  amount: number;
  currency?: string;
  name?: string;
  description?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  handler?: (proof: any) => void;
  modal?: {
    ondismiss?: () => void;
  };
  [key: string]: unknown;
}

export function buildCustomerRazorpayOptions<T extends Record<string, any>>(options: T) {
  const key = options.key ?? options.keyId;
  const order_id = options.order_id ?? options.orderId;
  const prefill = options.prefill ?? {
    name: options.customerName || '',
    email: options.email || '',
    contact: options.phone || '',
  };
  const theme = options.theme ?? {
    color: '#392535',
  };

  return {
    ...options,
    key,
    order_id,
    currency: options.currency || 'INR',
    name: options.name || 'Varnam Saree',
    description: options.description || (order_id ? `Order ${order_id}` : 'Varnam Saree Order'),
    prefill,
    theme,
    config: CUSTOMER_RAZORPAY_CONFIG,
  };
}
