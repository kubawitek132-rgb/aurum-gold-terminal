import { NextResponse } from 'next/server';
import { createTokenSearchService, TokenSearchError } from '@/lib/biuroTokens';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const search = createTokenSearchService();
const headers = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const data = await search(params.get('q'), params.get('chain') ?? 'all');
    return NextResponse.json(data, { headers });
  } catch (error) {
    const failure = error instanceof TokenSearchError ? error : new TokenSearchError('network', 'Nie udało się pobrać wyników. Spróbuj ponownie.');
    const status = failure.code === 'invalid_query' || failure.code === 'invalid_chain' ? 400 : failure.code === 'busy' ? 429 : 503;
    return NextResponse.json({ error: { code: failure.code, message: failure.message }, source: 'dexscreener', tradingEnabled: false }, { status, headers });
  }
}
