import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products, reviews } from '@/db/schema';
import { requireAdminSession } from '@/lib/admin-session';
import { ReviewInputError, reviewInput } from '@/lib/reviews';
import { reviewsError, reviewsHeaders, toReview } from '@/lib/reviews-server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

async function reviewId(context: Context): Promise<number> {
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) throw new ReviewInputError('Review ID must be a positive whole number.');
  return id;
}

/** Full update (Studio sends the whole review, including the show/hide flag). */
export async function PATCH(request: NextRequest, context: Context) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const id = await reviewId(context);
    const body = await request.json();
    const productIds = new Set((await db.select({ id: products.id }).from(products)).map((row) => row.id));
    const value = reviewInput(body, productIds);
    const [updated] = await db.update(reviews).set({ ...value, updatedAt: new Date() }).where(eq(reviews.id, id)).returning();
    return updated
      ? NextResponse.json({ review: toReview(updated) }, { headers: reviewsHeaders })
      : NextResponse.json({ error: 'Review not found.' }, { status: 404, headers: reviewsHeaders });
  } catch (error) { return reviewsError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const id = await reviewId(context);
    const removed = await db.delete(reviews).where(eq(reviews.id, id)).returning();
    return removed.length
      ? NextResponse.json({ success: true }, { headers: reviewsHeaders })
      : NextResponse.json({ error: 'Review not found.' }, { status: 404, headers: reviewsHeaders });
  } catch (error) { return reviewsError(error); }
}
