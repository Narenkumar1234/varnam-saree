import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { readOrderSnapshot } from '@/lib/pricing';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json(
        { success: false, error: 'Razorpay secret key not configured on server.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Support both naming styles: razorpay_order_id or order_id, razorpay_payment_id or payment_id
    const orderId = body.razorpay_order_id || body.order_id;
    const paymentId = body.razorpay_payment_id || body.payment_id;
    const signature = body.razorpay_signature || body.signature;
    const internalOrderId = body.orderId || body.internal_order_id;

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters (order_id, payment_id, and signature are required).',
        },
        { status: 400 }
      );
    }

    // Verify HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const data = `${orderId}|${paymentId}`;
    const generatedSignature = createHmac('sha256', keySecret).update(data).digest('hex');

    const expectedBuffer = Buffer.from(generatedSignature, 'hex');
    const receivedBuffer = Buffer.from(signature, 'hex');

    const isValid =
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature. Verification failed.' },
        { status: 400 }
      );
    }

    // If an internal order ID was provided, mark the order as paid in database if DB is configured
    if (internalOrderId && typeof internalOrderId === 'string') {
      try {
        const [savedOrder] = await db.select().from(orders).where(eq(orders.id, internalOrderId));
        if (savedOrder) {
          const raw = JSON.parse(savedOrder.itemsJson);
          const snapshot = Array.isArray(raw) ? { version: 1, items: raw } : raw;
          const payment = {
            provider: 'razorpay' as const,
            status: 'paid' as const,
            razorpayOrderId: orderId,
            paymentId,
            paidAt: new Date().toISOString(),
          };
          await db
            .update(orders)
            .set({ itemsJson: JSON.stringify({ ...snapshot, payment }) })
            .where(eq(orders.id, internalOrderId));
        }
      } catch (dbErr) {
        // If DB is offline or table is not reachable, do not crash payment confirmation
        console.warn('[Razorpay/verify-payment] Could not update DB order status:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully.',
      order_id: orderId,
      payment_id: paymentId,
    });
  } catch (err: any) {
    console.error('[Razorpay/verify-payment] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Payment verification failed.' },
      { status: 500 }
    );
  }
}
