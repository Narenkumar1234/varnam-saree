import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Razorpay credentials are not configured on the server.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let amount = Number(body.amount);

    // If amount is passed in rupees (e.g. 500 instead of 50000) or explicitly in paise
    // The requirement states: Minimum amount: 100 paise.
    if (!Number.isFinite(amount) || amount < 100) {
      return NextResponse.json(
        { error: 'Invalid amount. Minimum amount is 100 paise (₹1.00).' },
        { status: 400 }
      );
    }

    amount = Math.round(amount);
    const currency = typeof body.currency === 'string' && body.currency ? body.currency.toUpperCase() : 'INR';
    const receipt = typeof body.receipt === 'string' && body.receipt ? body.receipt.slice(0, 40) : `rcpt_${Date.now()}`;
    const notes = typeof body.notes === 'object' && body.notes !== null ? body.notes : {};

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (err: any) {
    console.error('[Razorpay/create-order] Error:', err);
    const status = err?.statusCode === 401 || err?.status === 401 ? 401 : 500;
    return NextResponse.json(
      {
        error: err?.error?.description || err?.message || 'Failed to create Razorpay order.',
      },
      { status }
    );
  }
}
