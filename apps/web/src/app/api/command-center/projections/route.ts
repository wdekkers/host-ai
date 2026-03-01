import { NextResponse } from 'next/server';

import { getApprovalQueueProjectionInSingleton, getPropertyStateProjectionInSingleton } from '@/lib/command-center-store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') ?? 'approval-queue';
  const rawLimit = url.searchParams.get('limit');

  if (kind !== 'approval-queue' && kind !== 'property-state') {
    return NextResponse.json({ error: "kind must be 'approval-queue' or 'property-state'." }, { status: 400 });
  }

  let limit: number | undefined;
  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json({ error: 'limit must be between 1 and 100.' }, { status: 400 });
    }
    limit = parsed;
  }

  if (kind === 'property-state') {
    return NextResponse.json({ projection: getPropertyStateProjectionInSingleton(limit ?? 20) });
  }

  return NextResponse.json({ projection: getApprovalQueueProjectionInSingleton(limit ?? 20) });
}
