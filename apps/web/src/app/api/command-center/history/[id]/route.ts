import { NextResponse } from 'next/server';

import { listAuditTimelineInSingleton } from '@/lib/command-center-store';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return NextResponse.json({ items: listAuditTimelineInSingleton({ draftId: id }) });
}
