import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, reviews } from '@/db/schema';
import { requireAdminSession } from '@/lib/admin-session';
import { reviewInput } from '@/lib/reviews';
import { readAllReviews, readReviewSettings, reviewsError, reviewsHeaders, toReview } from '@/lib/reviews-server';

export const dynamic = 'force-dynamic';

/** Studio: section settings plus every review (hidden ones included). */
export async function GET(request: NextRequest) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const [settings, list] = await Promise.all([readReviewSettings(), readAllReviews()]);
    return NextResponse.json({ settings, reviews: list }, { headers: reviewsHeaders });
  } catch (error) { return reviewsError(error); }
}

export async function POST(request: NextRequest) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const body = await request.json();
    const productIds = new Set((await db.select({ id: products.id }).from(products)).map((row) => row.id));
    const value = reviewInput(body, productIds);
    const existing = await readAllReviews();
    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const [created] = await db.insert(reviews).values({ ...value, sortOrder }).returning();
    return NextResponse.json({ review: toReview(created) }, { status: 201, headers: reviewsHeaders });
  } catch (error) { return reviewsError(error); }
}
