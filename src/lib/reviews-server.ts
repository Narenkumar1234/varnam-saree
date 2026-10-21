import { asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reviews, siteSettings } from '@/db/schema';
import {
  REVIEW_SETTING_KEYS,
  ReviewInputError,
  publicReviewsSection,
  reviewSettingsFromRows,
  type PublicReviewsSection,
  type Review,
  type ReviewSettings,
} from '@/lib/reviews';

const REVIEW_KEY_VALUES = Object.values(REVIEW_SETTING_KEYS);

export function toReview(row: typeof reviews.$inferSelect): Review {
  return {
    id: row.id,
    name: row.name,
    rating: row.rating,
    text: row.text,
    reviewDate: row.reviewDate ?? null,
    photoUrl: row.photoUrl ?? null,
    productId: row.productId ?? null,
    visible: row.visible,
    sortOrder: row.sortOrder,
  };
}

export async function readReviewSettings(): Promise<ReviewSettings> {
  return reviewSettingsFromRows(await db.select().from(siteSettings).where(inArray(siteSettings.key, REVIEW_KEY_VALUES)));
}

export async function readAllReviews(): Promise<Review[]> {
  return (await db.select().from(reviews).orderBy(asc(reviews.sortOrder), asc(reviews.id))).map(toReview);
}

/**
 * Landing-page read, fresh per request like getCommerce() (the layout is
 * force-dynamic, so an owner's change shows on the next page load). Returns null,
 * so nothing renders, when the section is off, has no visible review, or the
 * database/migration is unavailable. Only visible reviews are ever selected.
 */
export async function getPublicReviews(): Promise<PublicReviewsSection | null> {
  try {
    const settings = await readReviewSettings();
    if (!settings.enabled) return null;
    const rows = await db.select().from(reviews).where(eq(reviews.visible, true)).orderBy(asc(reviews.sortOrder), asc(reviews.id));
    return publicReviewsSection(settings, rows.map(toReview));
  } catch {
    return null;
  }
}

export async function saveReviewSettings(settings: ReviewSettings): Promise<void> {
  await db.transaction(async (tx) => {
    for (const field of Object.keys(REVIEW_SETTING_KEYS) as (keyof ReviewSettings)[]) {
      const key = REVIEW_SETTING_KEYS[field];
      const value = String(settings[field]);
      await tx.insert(siteSettings).values({ key, value }).onConflictDoUpdate({ target: siteSettings.key, set: { value } });
    }
  });
}

export const reviewsHeaders = { 'Cache-Control': 'no-store' };

export function reviewsError(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Enter valid JSON.' }, { status: 400, headers: reviewsHeaders });
  if (error instanceof ReviewInputError) return NextResponse.json({ error: error.message }, { status: 400, headers: reviewsHeaders });
  return NextResponse.json(
    { error: 'Reviews could not be saved or loaded. Check the database and run the migrations (bun run db:migrate).' },
    { status: 503, headers: reviewsHeaders },
  );
}
