import { money, VARNAM_CONFIG, capitalizeColour } from '@/data/products';
import type { OrderItem, OrderPricing, OrderPayment } from '@/types';

export interface WhatsAppProduct {
  id: number;
  name: string;
  price: number;
  type?: string;
  collection?: string;
  colour?: string;
  stock?: number | null;
}

export interface WhatsAppSavedOrder {
  id: string;
  total: number;
  items: OrderItem[];
  pricing?: OrderPricing;
  payment?: OrderPayment;
  status?: string;
  customerName?: string;
  phone?: string | null;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export function createWhatsAppOrderUrl(message: string): string | null {
  const number = getWhatsAppNumber();
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

/** Shared digits-only contact number for order URLs and visible retry help. */
export function getWhatsAppNumber(): string {
  return String(VARNAM_CONFIG.whatsappNumber || '').replace(/\D/g, '');
}

export function formatWhatsAppOrderMessage(
  lines: string[],
  heading = 'Hello Varnam, I would like to order:',
  closing = 'Please confirm availability and delivery details.'
): string {
  return [heading, ...lines, '', closing].join('\n');
}

export function createProductWhatsAppMessage(
  product: WhatsAppProduct,
  options: {
    quantity?: number;
    finish?: string;
    origin?: string;
    pricing?: OrderPricing;
    includeProductLink?: boolean;
  } = {}
): string {
  const quantity = typeof options.quantity === 'number' &&
    Number.isSafeInteger(options.quantity) && options.quantity > 0 ? options.quantity : 1;
  const productUrl = `${(options.origin || '').replace(/\/$/, '')}/product/${product.id}`;
  const lines = [
    `${product.name} × ${quantity}`,
    `Product ID: #${product.id}`,
    ...(product.type ? [`Fabric: ${product.type}`] : []),
    ...(product.collection ? [`Collection: ${product.collection}`] : []),
    ...(product.colour ? [`Colour: ${capitalizeColour(product.colour)}`] : []),
    `Unit price: ${money(product.price)}`,
  ];
  if (options.pricing) {
    const pricing = options.pricing;
    lines.push(`Subtotal: ${money(pricing.subtotal)}`);
    if (pricing.couponCode) lines.push(`${pricing.couponCode}: −${money(pricing.discountAmount)}`);
    lines.push(`Delivery: ${pricing.shipping ? money(pricing.shipping) : 'Free delivery'}`);
    lines.push(`Order total: ${money(pricing.total)}`);
  } else {
    lines.push(`Product total: ${money(product.price * quantity)}`);
    if (product.stock != null) {
      lines.push(`Availability: ${product.stock > 0 ? `${product.stock} in stock` : 'Please confirm restock availability'}`);
    }
  }
  if (options.includeProductLink !== false) lines.push(`Product: ${productUrl}`);
  return formatWhatsAppOrderMessage(lines);
}

export function createSavedOrderWhatsAppMessage(
  order: WhatsAppSavedOrder,
  catalogue: WhatsAppProduct[] = [],
  origin = ''
): string {
  const lines = [
    `Order: ${order.id}`,
    ...(order.status ? [`Status: ${order.status}`] : []),
    ...(order.payment ? [`Payment: ${order.payment.status === 'paid' ? (order.payment.provider === 'offline' ? `Paid offline${order.payment.method ? ` (${order.payment.method})` : ''}` : 'Paid via Razorpay') : order.payment.status === 'authorized' ? 'Authorized, awaiting capture' : 'Not yet confirmed'}`] : []),
    ...(order.payment?.paymentId ? [`Payment reference: ${order.payment.paymentId}`] : []),
    ...(order.customerName ? [`Customer: ${order.customerName}`] : []),
    ...(order.phone ? [`Customer phone: ${order.phone}`] : []),
    '',
    'Sarees:',
  ];
  for (const item of order.items) {
    const product = catalogue.find((entry) => entry.id === item.id);
    lines.push(`${item.name || product?.name || `Saree #${item.id}`} × ${item.qty}`);
    if (item.unitPrice !== undefined) lines.push(`  Unit price: ${money(item.unitPrice)}`);
    else if (product) lines.push(`  Current listed unit price: ${money(product.price)} (please confirm)`);
    if (item.total !== undefined) lines.push(`  Line total: ${money(item.total)}`);
  }
  if (order.pricing) {
    lines.push('', `Subtotal: ${money(order.pricing.subtotal)}`);
    if (order.pricing.couponCode) {
      lines.push(`${order.pricing.couponCode}: −${money(order.pricing.discountAmount)}`);
    }
    lines.push(`Delivery: ${order.pricing.shipping ? money(order.pricing.shipping) : 'Free delivery'}`);
  }
  lines.push(`Order total: ${money(order.total)}`);
  const address = [order.address, order.city, order.state, order.pincode].filter(Boolean).join(', ');
  if (address) lines.push(`Delivery address: ${address}`);
  if (origin) lines.push(`Tracking: ${origin.replace(/\/$/, '')}/track?order=${encodeURIComponent(order.id)}`);
  return formatWhatsAppOrderMessage(
    lines,
    'Hello Varnam, please review and confirm this order:',
    'Please confirm the sarees, order total and delivery arrangements.'
  );
}

export function openWhatsAppOrder(message: string): boolean {
  const url = createWhatsAppOrderUrl(message);
  if (!url || typeof window === 'undefined') return false;
  try {
    // Called synchronously from an order click. Top-level navigation does not
    // depend on a popup window or a noopener WindowProxy return value.
    window.location.assign(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a blank tab synchronously inside the checkout click (so popup blockers allow it);
 * the caller points it at WhatsApp once the order is saved. Returns null when blocked.
 */
export function openPendingWhatsAppWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    const pending = window.open('', '_blank');
    if (!pending) return null;
    try {
      pending.opener = null;
      pending.document.title = 'Opening WhatsApp…';
      pending.document.body.innerHTML = '<p style="font-family:system-ui,sans-serif;padding:24px;color:#392535">Saving your Varnam order and opening WhatsApp…</p>';
    } catch { /* cosmetic only */ }
    return pending;
  } catch {
    return null;
  }
}

/** WhatsApp message for an order just placed at checkout, including its real order ID. */
export function checkoutWhatsAppMessage(
  orderId: string,
  quote: { items: OrderItem[]; pricing: OrderPricing },
  customer: { first?: string; last?: string; phone?: string; address?: string; apartment?: string; landmark?: string; city?: string; state?: string; pin?: string },
  origin = '',
): string {
  return createSavedOrderWhatsAppMessage({
    id: orderId,
    status: 'Payment pending',
    total: quote.pricing.total,
    items: quote.items,
    pricing: quote.pricing,
    customerName: [customer.first, customer.last].filter(Boolean).join(' ').trim() || undefined,
    phone: customer.phone || null,
    address: [customer.address, customer.apartment, customer.landmark].filter(Boolean).join(', '),
    city: customer.city,
    state: customer.state,
    pincode: customer.pin,
  }, [], origin);
}
