import { NextResponse } from 'next/server';
import { verifyCheckout, PaymentError, type CheckoutProof } from '@/lib/razorpay';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fields: (keyof CheckoutProof)[] = ['orderId', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'];
    if (fields.some((field) => typeof body?.[field] !== 'string' || !body[field] || body[field].length > 200)) {
      return NextResponse.json({ error: 'Payment verification details are required.' }, { status: 400 });
    }
    const result = await verifyCheckout(body);
    return NextResponse.json(result, { status: result.status === 'paid' ? 200 : 202 });
  } catch (error) {
    const known = error instanceof PaymentError;
    return NextResponse.json({ error: known ? error.message : 'Unable to verify payment yet. Retry verification or contact Varnam on WhatsApp before paying again.' }, { status: known ? error.status : error instanceof SyntaxError ? 400 : 502 });
  }
}
