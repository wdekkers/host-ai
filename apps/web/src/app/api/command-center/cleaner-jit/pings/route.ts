import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { createCleanerJitPingInSingleton, listCleanerJitPingsInSingleton } from '@/lib/command-center-store';

const createCleanerPingSchema = z.object({
  reservationId: z.string().min(1),
  cleanerId: z.string().min(1),
  reason: z.string().min(1)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reservationId = url.searchParams.get('reservationId') ?? undefined;
  return NextResponse.json({ items: listCleanerJitPingsInSingleton(reservationId) });
}

export async function POST(request: Request) {
  try {
    const parsed = createCleanerPingSchema.parse(await request.json());
    return NextResponse.json({ item: createCleanerJitPingInSingleton(parsed) }, { status: 201 });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/cleaner-jit/pings' });
  }
}
