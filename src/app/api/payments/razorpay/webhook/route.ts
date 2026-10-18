import { NextResponse } from 'next/server';
import { receiveWebhook, PaymentError } from '@/lib/razorpay';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // The signature covers the exact bytes, before JSON parsing.
    await receiveWebhook(await request.text(), request.headers.get('x-razorpay-signature') || '');
    return NextResponse.json({ received: true });
  } catch (error) {
    const known = error instanceof PaymentError;
    return NextResponse.json({ error: known ? error.message : 'Unable to process payment event.' }, { status: known ? error.status : error instanceof SyntaxError ? 400 : 500 });
  }
}
