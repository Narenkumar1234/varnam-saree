import { NextResponse } from 'next/server';
import { createCheckout, PaymentError } from '@/lib/razorpay';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.orderId !== 'string' || !body.orderId || body.orderId.length > 200) {
      return NextResponse.json({ error: 'A valid order ID is required.' }, { status: 400 });
    }
    return NextResponse.json(await createCheckout(body.orderId));
  } catch (error) {
    const known = error instanceof PaymentError;
    return NextResponse.json({ error: known ? error.message : 'Unable to start payment. Please try again or order on WhatsApp.' }, { status: known ? error.status : error instanceof SyntaxError ? 400 : 502 });
  }
}
