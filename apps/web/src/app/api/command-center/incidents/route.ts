import { createIncidentInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { createIncidentInSingleton, listIncidentsInSingleton } from '@/lib/command-center-store';

export async function GET() {
  return NextResponse.json({ items: listIncidentsInSingleton() });
}

export async function POST(request: Request) {
  try {
    const parsed = createIncidentInputSchema.parse(await request.json());
    return NextResponse.json({ item: createIncidentInSingleton(parsed.summary) }, { status: 201 });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/incidents' });
  }
}
