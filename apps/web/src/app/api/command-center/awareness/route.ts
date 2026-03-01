import { NextResponse } from 'next/server';

import { getOperationalAwarenessInSingleton, listEventsInSingleton } from '@/lib/command-center-store';

export async function GET() {
  return NextResponse.json({
    awareness: getOperationalAwarenessInSingleton(),
    recentEvents: listEventsInSingleton().slice(-10).reverse()
  });
}
