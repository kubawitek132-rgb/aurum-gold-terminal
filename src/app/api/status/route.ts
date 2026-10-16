import { NextResponse } from 'next/server';
import { cacheKeys, peek } from '@/lib/cache';
import { tdConfigured } from '@/lib/providers/twelvedata';
import { fredConfigured } from '@/lib/providers/fred';
import { aisEnabled } from '@/lib/providers/aisstream';
import { telegramConfigured } from '@/lib/services/alerts';
import { redisEnabled } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/** Diagnostyka: stan każdego źródła w cache + konfiguracja kluczy (bez ich wartości). */
export async function GET() {
  const sources = cacheKeys().map((k) => {
    const v = peek<unknown>(k);
    return { key: k, source: v?.source ?? 'ładowanie…', updatedAt: v?.updatedAt ?? null, stale: v?.stale ?? false, missing: v?.missing ?? false, loading: v ? v.inflight : true, error: v?.error };
  });
  return NextResponse.json({
    config: {
      fred: fredConfigured(),
      twelvedataSeasonality: tdConfigured(),
      aisstream: aisEnabled(),
      telegram: telegramConfigured(),
      redis: redisEnabled(),
    },
    sources: sources.sort((a, b) => a.key.localeCompare(b.key)),
    uptimeSec: Math.round(process.uptime()),
    serverTime: new Date().toISOString(),
  });
}
