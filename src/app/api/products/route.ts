import { NextResponse } from 'next/server';
import { getCatalogue } from '@/lib/catalogue-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getCatalogue(), { headers: { 'Cache-Control': 'no-store' } });
}
