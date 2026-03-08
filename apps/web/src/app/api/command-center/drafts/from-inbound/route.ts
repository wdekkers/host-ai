import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { regenerateDraftFromInboundInSingleton } from '@/lib/command-center-store';

const regenerateDraftInputSchema = z.object({
  draftId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = regenerateDraftInputSchema.parse(await request.json());
    return NextResponse.json({ item: regenerateDraftFromInboundInSingleton(parsed.draftId) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/drafts/from-inbound' });
  }
}
