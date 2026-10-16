import { NextResponse, type NextRequest } from 'next/server';
import { getGoldCalendar } from '@/lib/services/data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const days = Math.min(180, Math.max(7, Number(req.nextUrl.searchParams.get('days') ?? 60) || 60));
  return NextResponse.json(getGoldCalendar(days));
}
