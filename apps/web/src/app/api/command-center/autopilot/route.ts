import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import {
  evaluateAutopilotActionInSingleton,
  listAutopilotActionsInSingleton,
} from '@/lib/command-center-store';

const evaluateAutopilotSchema = z.object({
  reservationId: z.string().min(1),
  intent: z.string().min(1),
  body: z.string().min(1),
});

export async function GET(_request: Request) {
  void _request;
  return NextResponse.json({ items: listAutopilotActionsInSingleton() });
}

export async function POST(request: Request) {
  try {
    const parsed = evaluateAutopilotSchema.parse(await request.json());
    const action = evaluateAutopilotActionInSingleton(parsed);
    return NextResponse.json({
      actionId: action.id,
      decision: action.decision,
      reason: action.reason,
      status: action.status,
    });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/autopilot' });
  }
}
