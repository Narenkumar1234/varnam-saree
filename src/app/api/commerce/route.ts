import { NextResponse } from 'next/server';
import { getCommerce } from '@/lib/commerce-server';

export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(await getCommerce(), { headers: { 'Cache-Control': 'no-store' } });
}
