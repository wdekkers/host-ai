import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { getIncidentResponsePlanInSingleton } from '@/lib/command-center-store';

const inputSchema = z.object({ incidentId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.parse(await request.json());
    return NextResponse.json(getIncidentResponsePlanInSingleton(parsed.incidentId));
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/incidents/response-plan' });
  }
}
