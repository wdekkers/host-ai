import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { runJitChecksInSingleton } from '@/lib/command-center-store';

const inputSchema = z.object({
  reservationId: z.string().min(1),
  requestType: z.enum(['early-check-in', 'late-checkout']),
});

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.parse(await request.json());
    return NextResponse.json(runJitChecksInSingleton(parsed));
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/monitoring/jit-checks' });
  }
}
