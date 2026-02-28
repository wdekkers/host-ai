import { NextResponse } from 'next/server';

import { listQueue } from '@/lib/command-center-store';

export async function GET() {
  return NextResponse.json({ items: listQueue() });
}
