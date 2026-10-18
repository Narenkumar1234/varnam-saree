import { money, VARNAM_CONFIG } from '@/data/products';
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
  const number = String(VARNAM_CONFIG.whatsappNumber || '').replace(/\D/g, '');
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
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
    ...(product.colour ? [`Colour: ${product.colour}`] : []),
    `Finishing: ${options.finish || 'Unstitched blouse · included'}`,
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
    ...(order.payment ? [`Payment: ${order.payment.status === 'paid' ? 'Paid via Razorpay' : order.payment.status === 'authorized' ? 'Authorized, awaiting capture' : 'Not yet confirmed'}`] : []),
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
    if (item.finish) lines.push(`  Finishing: ${item.finish}`);
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
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
