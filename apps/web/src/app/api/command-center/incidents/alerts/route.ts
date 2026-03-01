import { NextResponse } from 'next/server';

import { listIncidentAlertDraftsInSingleton } from '@/lib/command-center-store';

export async function GET(request: Request) {
  void request;
  return NextResponse.json({ items: listIncidentAlertDraftsInSingleton() });
}
