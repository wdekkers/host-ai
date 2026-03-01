import { NextResponse } from 'next/server';

import { listAuditTimelineInSingleton } from '@/lib/command-center-store';

const validActions = new Set(['created', 'edited', 'approved', 'sent', 'rejected']);

const toIsoIfValid = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const draftId = url.searchParams.get('draftId') ?? undefined;
  const actorId = url.searchParams.get('actorId') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const format = url.searchParams.get('format') ?? 'json';
  const since = url.searchParams.get('since') ?? undefined;
  const until = url.searchParams.get('until') ?? undefined;

  if (action && !validActions.has(action)) {
    return NextResponse.json({ error: 'Invalid action filter.' }, { status: 400 });
  }

  const normalizedSince = toIsoIfValid(since);
  if (since && !normalizedSince) {
    return NextResponse.json({ error: 'Invalid since timestamp.' }, { status: 400 });
  }

  const normalizedUntil = toIsoIfValid(until);
  if (until && !normalizedUntil) {
    return NextResponse.json({ error: 'Invalid until timestamp.' }, { status: 400 });
  }

  if (normalizedSince && normalizedUntil && normalizedSince > normalizedUntil) {
    return NextResponse.json({ error: 'since must be earlier than or equal to until.' }, { status: 400 });
  }

  if (format !== 'json' && format !== 'csv') {
    return NextResponse.json({ error: 'format must be json or csv.' }, { status: 400 });
  }

  const items = listAuditTimelineInSingleton({
    draftId,
    actorId,
    action: action as 'created' | 'edited' | 'approved' | 'sent' | 'rejected' | undefined,
    since: normalizedSince ?? undefined,
    until: normalizedUntil ?? undefined
  });

  if (format === 'csv') {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = ['draftId', 'reservationId', 'intent', 'action', 'actorId', 'timestamp', 'before', 'after'].join(',');
    const rows = items.map((entry) =>
      [
        escapeCsv(entry.draftId),
        escapeCsv(entry.reservationId),
        escapeCsv(entry.intent),
        escapeCsv(entry.action),
        escapeCsv(entry.actorId),
        escapeCsv(entry.timestamp),
        escapeCsv(entry.before ? JSON.stringify(entry.before) : ''),
        escapeCsv(entry.after ? JSON.stringify(entry.after) : '')
      ].join(',')
    );
    return new Response([header, ...rows].join('\n'), {
      status: 200,
      headers: { 'content-type': 'text/csv; charset=utf-8' }
    });
  }

  return NextResponse.json({ items });
}
