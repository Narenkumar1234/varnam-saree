import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import Razorpay from 'razorpay';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { readOrderSnapshot } from '@/lib/pricing';
import { deriveOrderStatusFromPayment } from '@/lib/order-status';
import { notifyAdminsOfOrder } from '@/lib/telegram';
import type { OrderPayment } from '@/types';

export class PaymentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function gateway() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) {
    throw new PaymentError('Online payments are unavailable. Please use WhatsApp to arrange your order.', 503);
  }
  return { client: new Razorpay({ key_id: keyId, key_secret: secret }), keyId, secret };
}

export function validSignature(body: string, signature: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

function amountInPaise(total: number) {
  const amount = total * 100;
  if (!Number.isSafeInteger(amount) || amount < 100) throw new PaymentError('This order has an invalid payment total.');
  return amount;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SavedOrder = typeof orders.$inferSelect;

async function lockedOrder(tx: Transaction, id: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
  if (!order) throw new PaymentError('Order not found.', 404);
  return order;
}

async function savePayment(tx: Transaction, order: SavedOrder, payment: OrderPayment) {
  const raw = JSON.parse(order.itemsJson);
  const snapshot = Array.isArray(raw) ? { version: 1, items: raw } : raw;
  const updates: { itemsJson: string; status?: string } = {
    itemsJson: JSON.stringify({ ...snapshot, payment }),
  };
  if (payment.status === 'paid') {
    const nextStatus = deriveOrderStatusFromPayment(order.status, payment);
    if (nextStatus !== order.status) updates.status = nextStatus;
  }
  await tx.update(orders).set(updates).where(eq(orders.id, order.id));
}

function assertPayable(order: SavedOrder) {
  if (order.status?.toLowerCase() === 'cancelled') throw new PaymentError('This order is cancelled.', 409);
  if (!readOrderSnapshot(order.itemsJson).items.length) throw new PaymentError('This order has no products.');
  return amountInPaise(order.total);
}

export async function createCheckout(orderId: string) {
  const { client, keyId } = gateway();
  return db.transaction(async (tx) => {
    const order = await lockedOrder(tx, orderId);
    const saved = readOrderSnapshot(order.itemsJson).payment;
    if (saved?.status === 'paid' || saved?.provider === 'offline') return { status: 'paid' as const };
    const amount = assertPayable(order);
    if (saved && (saved.amount !== amount || saved.currency !== 'INR')) {
      throw new PaymentError('The saved payment total does not match this order. Please contact Varnam.', 409);
    }
    // A lock serializes double-clicks and concurrent requests. Never make a second
    // gateway order when the first one can still be paid or is awaiting capture.
    const remote = saved?.razorpayOrderId
      ? await client.orders.fetch(saved.razorpayOrderId)
      : await client.orders.create({ amount, currency: 'INR', receipt: createHash('sha256').update(order.id).digest('hex').slice(0, 40), notes: { localOrderId: order.id } });
    if (Number(remote.amount) !== amount || remote.currency !== 'INR') throw new PaymentError('Payment total mismatch.', 409);
    if (!saved) {
      await savePayment(tx, order, { provider: 'razorpay', status: 'pending', razorpayOrderId: remote.id, amount, currency: 'INR' });
    }
    if (remote.status === 'paid' || saved?.status === 'authorized') {
      return { status: 'processing' as const };
    }
    return { status: 'checkout' as const, keyId, orderId: remote.id, amount, currency: 'INR' as const };
  });
}

export interface CheckoutProof { orderId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

async function recordPayment(tx: Transaction, order: SavedOrder, paymentId: string, client: Razorpay) {
  const saved = readOrderSnapshot(order.itemsJson).payment;
  if (!saved?.razorpayOrderId) throw new PaymentError('Start the payment from this order first.', 409);
  const paid = await client.payments.fetch(paymentId);
  if (paid.order_id !== saved.razorpayOrderId || Number(paid.amount) !== saved.amount ||
      saved.amount !== amountInPaise(order.total) || paid.currency !== 'INR') {
    throw new PaymentError('The payment details do not match this order.', 409);
  }
  if (saved.status === 'paid') {
    if (saved.paymentId !== paid.id) throw new PaymentError('This order is already paid with another payment.', 409);
    return { status: 'paid' as const, recordedPaid: false };
  }
  // A successful Checkout signature can arrive while funds are only authorized.
  // Only a captured payment is recorded as paid; the webhook completes late captures.
  if (paid.status !== 'captured' && paid.status !== 'authorized') throw new PaymentError('The payment has not succeeded. Please use WhatsApp if you need help.', 409);
  const captured = paid.status === 'captured' && paid.captured === true;
  const payment: OrderPayment = { ...saved, status: captured ? 'paid' : 'authorized', paymentId: paid.id, ...(captured ? { paidAt: new Date().toISOString() } : {}) };
  await savePayment(tx, order, payment);
  return { status: captured ? 'paid' as const : 'processing' as const, recordedPaid: captured };
}

export async function verifyCheckout(proof: CheckoutProof) {
  const { client, secret } = gateway();
  const outcome = await db.transaction(async (tx) => {
    const order = await lockedOrder(tx, proof.orderId);
    const saved = readOrderSnapshot(order.itemsJson).payment;
    if (!saved || saved.razorpayOrderId !== proof.razorpay_order_id ||
        !validSignature(`${saved.razorpayOrderId}|${proof.razorpay_payment_id}`, proof.razorpay_signature, secret)) {
      throw new PaymentError('Payment verification failed. Please contact Varnam if your account was debited.', 400);
    }
    const result = await recordPayment(tx, order, proof.razorpay_payment_id, client);
    return { ...result, order };
  });
  if (outcome.recordedPaid) {
    await notifyAdminsOfOrder({ ...outcome.order, paymentStatus: 'paid' });
  }
  return { status: outcome.status };
}

export async function receiveWebhook(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new PaymentError('Payment webhook is not configured.', 503);
  if (!validSignature(rawBody, signature, secret)) throw new PaymentError('Invalid webhook signature.', 400);
  const event = JSON.parse(rawBody);
  if (event.event !== 'payment.captured') return;
  const payment = event.payload?.payment?.entity;
  if (typeof payment?.id !== 'string' || typeof payment?.order_id !== 'string') throw new PaymentError('Invalid payment event.');
  const { client } = gateway();
  const remote = await client.orders.fetch(payment.order_id);
  const orderId = remote.notes?.localOrderId;
  // Ignore payments from other integrations on the same Razorpay account.
  if (typeof orderId !== 'string') return;
  const outcome = await db.transaction(async (tx) => {
    const order = await lockedOrder(tx, orderId);
    const saved = readOrderSnapshot(order.itemsJson).payment;
    if (saved?.status === 'paid') return { recordedPaid: false as const, order };
    if (saved?.razorpayOrderId !== payment.order_id) {
      throw new PaymentError('Payment order mismatch.', 409);
    }
    const result = await recordPayment(tx, order, payment.id, client);
    return { ...result, order };
  });
  if (outcome.recordedPaid) {
    await notifyAdminsOfOrder({ ...outcome.order, paymentStatus: 'paid' });
  }
}

export { CUSTOMER_RAZORPAY_CONFIG, buildCustomerRazorpayOptions } from './customer-razorpay';
