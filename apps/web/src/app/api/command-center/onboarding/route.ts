import { hostOnboardingInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { onboardHostInSingleton } from '@/lib/command-center-store';

export async function POST(request: Request) {
  try {
    const parsed = hostOnboardingInputSchema.parse(await request.json());
    return NextResponse.json({ host: onboardHostInSingleton(parsed.hostId) }, { status: 201 });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/onboarding' });
  }
}
