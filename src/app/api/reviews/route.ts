import { NextResponse } from 'next/server';
import { getPublicReviews } from '@/lib/reviews-server';

export const dynamic = 'force-dynamic';

/** Public read: the section (visible reviews only) or null when it is switched off. */
export async function GET() {
  return NextResponse.json({ section: await getPublicReviews() }, { headers: { 'Cache-Control': 'no-store' } });
}
