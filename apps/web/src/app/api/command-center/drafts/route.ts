import { createDraftInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { createDraftInSingleton } from '@/lib/command-center-store';

export async function POST(request: Request) {
  try {
    const parsed = createDraftInputSchema.parse(await request.json());
    const item = createDraftInSingleton(parsed);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/drafts' });
  }
}
