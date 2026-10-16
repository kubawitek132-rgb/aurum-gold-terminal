import { NextResponse } from 'next/server';
import { getHubs } from '@/lib/services/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getHubs());
}
