import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { rollbackAutopilotActionInSingleton } from '@/lib/command-center-store';

const rollbackSchema = z.object({
  actionId: z.string().min(1),
  reason: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const parsed = rollbackSchema.parse(await request.json());
    return NextResponse.json({ item: rollbackAutopilotActionInSingleton(parsed) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/autopilot/rollback' });
  }
}
