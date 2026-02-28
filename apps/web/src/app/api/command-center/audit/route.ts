import { NextResponse } from 'next/server';

import { listAuditTimelineInSingleton } from '@/lib/command-center-store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const draftId = url.searchParams.get('draftId') ?? undefined;
  const actorId = url.searchParams.get('actorId') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const since = url.searchParams.get('since') ?? undefined;
  const until = url.searchParams.get('until') ?? undefined;

  return NextResponse.json({
    items: listAuditTimelineInSingleton({
      draftId,
      actorId,
      action: action as 'created' | 'edited' | 'approved' | 'sent' | undefined,
      since,
      until
    })
  });
}
