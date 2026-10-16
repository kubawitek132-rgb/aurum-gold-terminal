import { NextResponse } from 'next/server';
import { getPolicyPulse } from '@/lib/services/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getPolicyPulse());
}
