import { createDraftInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { createDraftInSingleton } from '@/lib/command-center-store';

export async function POST(request: Request) {
  try {
    const parsed = createDraftInputSchema.parse(await request.json());
    const item = createDraftInSingleton(parsed);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
