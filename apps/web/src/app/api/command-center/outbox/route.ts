import { NextResponse } from 'next/server';

import { listOutboxRecordsInSingleton, retryOutboxByDestinationInSingleton } from '@/lib/command-center-store';

const validDestinations = new Set(['audit-log', 'projection-updater', 'notifications']);
const validStatuses = new Set(['pending', 'retrying', 'delivered', 'failed']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = url.searchParams.get('destination') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const rawLimit = url.searchParams.get('limit');

  if (destination && !validDestinations.has(destination)) {
    return NextResponse.json({ error: 'Invalid destination filter.' }, { status: 400 });
  }

  if (status && !validStatuses.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 });
  }

  let limit: number | undefined;
  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
      return NextResponse.json({ error: 'limit must be between 1 and 200.' }, { status: 400 });
    }
    limit = parsed;
  }

  return NextResponse.json({
    items: listOutboxRecordsInSingleton({
      destination: destination as 'audit-log' | 'projection-updater' | 'notifications' | undefined,
      status: status as 'pending' | 'retrying' | 'delivered' | 'failed' | undefined,
      limit
    })
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        destination?: 'audit-log' | 'projection-updater' | 'notifications';
        limit?: number;
      }
    | null;

  if (!body || !body.destination || !validDestinations.has(body.destination)) {
    return NextResponse.json({ error: 'destination is required and must be valid.' }, { status: 400 });
  }

  if (body.limit !== undefined && (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 200)) {
    return NextResponse.json({ error: 'limit must be between 1 and 200.' }, { status: 400 });
  }

  const items = retryOutboxByDestinationInSingleton({
    destination: body.destination,
    limit: body.limit
  });

  return NextResponse.json({
    processed: items.length,
    items
  });
}
