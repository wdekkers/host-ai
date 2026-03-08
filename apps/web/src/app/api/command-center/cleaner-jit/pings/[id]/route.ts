import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { updateCleanerJitPingInSingleton } from '@/lib/command-center-store';

const updateCleanerPingSchema = z.object({
  status: z.enum(['READY', 'ETA', 'NOT_READY']),
  note: z.string().optional(),
  etaMinutes: z.number().int().positive().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const parsed = updateCleanerPingSchema.parse(await request.json());
    return NextResponse.json({ item: updateCleanerJitPingInSingleton(id, parsed) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/cleaner-jit/pings/[id]' });
  }
}
