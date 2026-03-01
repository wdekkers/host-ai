import { NextResponse } from 'next/server';

import { getIncidentTimelineInSingleton } from '@/lib/command-center-store';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return NextResponse.json({ items: getIncidentTimelineInSingleton(id) });
}
