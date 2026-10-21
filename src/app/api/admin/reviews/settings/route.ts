import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-session';
import { reviewSettingsInput } from '@/lib/reviews';
import { reviewsError, reviewsHeaders, saveReviewSettings } from '@/lib/reviews-server';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const settings = reviewSettingsInput(await request.json());
    await saveReviewSettings(settings);
    return NextResponse.json({ settings }, { headers: reviewsHeaders });
  } catch (error) { return reviewsError(error); }
}
