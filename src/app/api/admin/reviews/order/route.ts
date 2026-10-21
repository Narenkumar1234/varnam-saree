import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { reviews } from '@/db/schema';
import { requireAdminSession } from '@/lib/admin-session';
import { reviewOrderInput } from '@/lib/reviews';
import { readAllReviews, reviewsError, reviewsHeaders } from '@/lib/reviews-server';

export const dynamic = 'force-dynamic';

/** Reorder: body { ids: [...] } listing every review once, in display order. */
export async function PUT(request: NextRequest) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const body = await request.json();
    const existing = await readAllReviews();
    const ids = reviewOrderInput(body, existing.map((row) => row.id));
    await db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) await tx.update(reviews).set({ sortOrder: index }).where(eq(reviews.id, id));
    });
    return NextResponse.json({ reviews: await readAllReviews() }, { headers: reviewsHeaders });
  } catch (error) { return reviewsError(error); }
}
