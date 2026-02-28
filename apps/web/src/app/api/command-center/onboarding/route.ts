import { hostOnboardingInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { onboardHostInSingleton } from '@/lib/command-center-store';

export async function POST(request: Request) {
  try {
    const parsed = hostOnboardingInputSchema.parse(await request.json());
    return NextResponse.json({ host: onboardHostInSingleton(parsed.hostId) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
