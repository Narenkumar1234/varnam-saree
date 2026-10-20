/**
 * Server-only Telegram admin notifications.
 * Do not import this module from Client Components — it reads TELEGRAM_BOT_TOKEN.
 */

import { money } from '@/data/products';
import { orderDeliveryLines, type OrderDeliveryFields } from '@/lib/address-validation';
import { readOrderSnapshot } from '@/lib/pricing';
import { getSiteUrl } from '@/lib/site-url';
import type { OrderItem, OrderPricing } from '@/types';

export const TELEGRAM_TIMEOUT_MS = 3000;

export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type TelegramPaymentStatus = 'paid' | 'pending payment';

export interface TelegramOrderNotice extends OrderDeliveryFields {
  id: string;
  total: number;
  itemsJson?: string | null;
  items?: OrderItem[];
  pricing?: OrderPricing;
  paymentStatus?: TelegramPaymentStatus;
}

export function parseTelegramChatIds(value: string | undefined): string[] {
  return (value || '').split(',').map((id) => id.trim()).filter(Boolean);
}

export function formatOrderAdminMessage(order: TelegramOrderNotice): string {
  const snapshot = order.itemsJson ? readOrderSnapshot(order.itemsJson) : { items: order.items || [], pricing: order.pricing };
  const items = snapshot.items;
  const pricing = snapshot.pricing || order.pricing;
  const status = order.paymentStatus
    || (snapshot.payment?.status === 'paid' ? 'paid' : 'pending payment');
  const name = (order.shippingFullName || order.customerName || 'Customer').trim();
  const phone = (order.shippingPhone || order.phone || '').trim();
  const studioUrl = `${getSiteUrl().origin}/studio-desk`;

  const itemLines = items.map((item) => {
    const extra = [item.finish, (item as { colour?: string }).colour]
      .filter((part): part is string => Boolean(part && part !== 'Included'))
      .join(', ');
    const price = item.total ?? (item.unitPrice != null ? item.unitPrice * item.qty : undefined);
    const itemName = item.name || `Saree #${item.id}`;
    return `• ${escapeTelegramHtml(itemName)}${extra ? ` (${escapeTelegramHtml(extra)})` : ''} × ${item.qty}${price != null ? ` — ${money(price)}` : ''}`;
  });

  const parts = [
    `<b>New Varnam order ${escapeTelegramHtml(order.id)}</b>`,
    `Status: ${escapeTelegramHtml(status)}`,
    `Customer: ${escapeTelegramHtml(name)}`,
    `Email: ${escapeTelegramHtml((order.email || '').trim() || '—')}`,
    `Phone: ${escapeTelegramHtml(phone || '—')}`,
    '',
    '<b>Delivery</b>',
    ...(orderDeliveryLines(order).map((row) => escapeTelegramHtml(row))),
    '',
    '<b>Items</b>',
    ...(itemLines.length ? itemLines : ['• (no items)']),
  ];
  if (pricing?.couponCode && pricing.discountAmount) {
    parts.push('', `Coupon ${escapeTelegramHtml(pricing.couponCode)}: −${money(pricing.discountAmount)}`);
  } else if (pricing?.discountAmount) {
    parts.push('', `Discount: −${money(pricing.discountAmount)}`);
  }
  parts.push(`Total: ${money(order.total)}`, '', `<a href="${escapeTelegramHtml(studioUrl)}">Open in Studio</a>`);
  return parts.join('\n');
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    if (!response.ok) console.warn('Telegram sendMessage failed.', response.status);
  } catch {
    console.warn('Telegram sendMessage failed.');
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyAdminsOfOrder(order: TelegramOrderNotice): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatIds = parseTelegramChatIds(process.env.TELEGRAM_ADMIN_CHAT_IDS);
    if (!token || chatIds.length === 0) {
      console.warn('Telegram admin notifications are not configured.');
      return;
    }
    const text = formatOrderAdminMessage(order);
    await Promise.all(chatIds.map((chatId) => sendTelegramMessage(token, chatId, text)));
  } catch {
    console.warn('Telegram admin notification failed.');
  }
}
