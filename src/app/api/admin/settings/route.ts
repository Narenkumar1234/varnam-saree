import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { siteSettings } from '@/db/schema';
import { requireAdminSession } from '@/lib/admin-session';
import { SETTING_KEYS, settingsFromRows } from '@/lib/commerce';
import { settingsInput } from '@/lib/commercial-input';
import { commercialError, commercialHeaders } from '@/lib/commercial-admin';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try { return NextResponse.json({ settings: settingsFromRows(await db.select().from(siteSettings)) }, { headers: commercialHeaders }); }
  catch (error) { return commercialError(error); }
}
export async function PUT(request: NextRequest) {
  const denied = requireAdminSession(request); if (denied) return denied;
  try {
    const settings = settingsInput(await request.json());
    await db.transaction(async (tx) => {
      for (const key of SETTING_KEYS) await tx.insert(siteSettings).values({ key, value: String(settings[key]) }).onConflictDoUpdate({ target: siteSettings.key, set: { value: String(settings[key]) } });
    });
    return NextResponse.json({ settings }, { headers: commercialHeaders });
  } catch (error) { return commercialError(error); }
}
