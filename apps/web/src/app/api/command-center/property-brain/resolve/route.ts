import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { resolvePropertyPolicyInSingleton } from '@/lib/command-center-store';

const resolveSchema = z.object({
  propertyId: z.string().min(1),
  intent: z.string().min(1),
  amenity: z.enum(['poolHeating', 'hotTub', 'sauna', 'wifi', 'bbq']).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = resolveSchema.parse(await request.json());
    return NextResponse.json(resolvePropertyPolicyInSingleton(parsed));
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/property-brain/resolve' });
  }
}
