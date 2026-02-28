import { rolloutActionInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { completeInternalValidationInSingleton, getRolloutStateInSingleton } from '@/lib/command-center-store';

export async function GET() {
  return NextResponse.json({ rollout: getRolloutStateInSingleton() });
}

export async function PATCH(request: Request) {
  try {
    rolloutActionInputSchema.parse(await request.json());
    return NextResponse.json({ rollout: completeInternalValidationInSingleton() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
