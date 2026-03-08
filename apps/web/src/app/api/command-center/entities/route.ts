import { NextResponse } from 'next/server';

import { getNormalizedEntitiesInSingleton } from '@/lib/command-center-store';

const validKinds = new Set(['all', 'properties', 'guests', 'reservations', 'messages']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') ?? 'all';

  if (!validKinds.has(kind)) {
    return NextResponse.json({ error: 'Invalid entities kind filter.' }, { status: 400 });
  }

  return NextResponse.json({
    entities: getNormalizedEntitiesInSingleton(
      kind as 'all' | 'properties' | 'guests' | 'reservations' | 'messages',
    ),
  });
}
