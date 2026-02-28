import { transitionIncidentInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { transitionIncidentInSingleton } from '@/lib/command-center-store';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const parsed = transitionIncidentInputSchema.parse(await request.json());
    return NextResponse.json({ item: transitionIncidentInSingleton(id, parsed.next) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
