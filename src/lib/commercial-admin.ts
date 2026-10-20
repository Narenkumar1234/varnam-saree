import { NextResponse } from 'next/server';
import { CommercialInputError } from '@/lib/commercial-input';

export function commercialError(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Enter valid JSON.' }, { status: 400 });
  if (error instanceof CommercialInputError) return NextResponse.json({ error: error.message }, { status: 400 });
  const failure = error as { code?: string; cause?: { code?: string } };
  if (failure?.code === '23505' || failure?.cause?.code === '23505') return NextResponse.json({ error: 'That coupon code already exists.' }, { status: 409 });
  return NextResponse.json({ error: 'Commercial settings could not be saved or loaded. Check the database and run the migrations.' }, { status: 503 });
}

export const commercialHeaders = { 'Cache-Control': 'no-store' };
