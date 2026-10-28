import { NextResponse } from 'next/server';
import { createBiuroMarketsCache } from '@/lib/biuroMarkets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const marketsSnapshot = createBiuroMarketsCache();

export async function GET() {
  const markets = await marketsSnapshot();
  return NextResponse.json(markets, {
    status: markets.assets.length ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
