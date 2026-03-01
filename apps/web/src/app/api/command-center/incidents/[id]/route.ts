import { transitionIncidentInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { transitionIncidentInSingleton } from '@/lib/command-center-store';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const parsed = transitionIncidentInputSchema.parse(await request.json());
    return NextResponse.json({ item: transitionIncidentInSingleton(id, parsed.next) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/incidents/[id]' });
  }
}
