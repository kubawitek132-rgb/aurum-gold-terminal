import { NextResponse } from 'next/server';
import { getBanks } from '@/lib/services/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getBanks());
}
