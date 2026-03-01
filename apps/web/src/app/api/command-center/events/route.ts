import { NextResponse } from 'next/server';

import { listEventRecordsInSingleton } from '@/lib/command-center-store';

const validTypes = new Set([
  'draft.created',
  'draft.edited',
  'draft.approved',
  'draft.sent',
  'draft.rejected',
  'message.ingested',
  'incident.created',
  'incident.transitioned'
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? undefined;
  const actorId = url.searchParams.get('actorId') ?? undefined;
  const rawLimit = url.searchParams.get('limit');

  if (type && !validTypes.has(type)) {
    return NextResponse.json({ error: 'Invalid event type filter.' }, { status: 400 });
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
    items: listEventRecordsInSingleton({
      type: type as
        | 'draft.created'
        | 'draft.edited'
        | 'draft.approved'
        | 'draft.sent'
        | 'draft.rejected'
        | 'message.ingested'
        | 'incident.created'
        | 'incident.transitioned'
        | undefined,
      actorId,
      limit
    })
  });
}
