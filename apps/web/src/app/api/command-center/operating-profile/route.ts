import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { getOperatingProfileInSingleton, updateOperatingProfileInSingleton } from '@/lib/command-center-store';

const updateOperatingProfileSchema = z.object({
  strictness: z.number().min(0).max(100).optional(),
  generosity: z.number().min(0).max(100).optional(),
  compensationCapUsd: z.number().min(0).max(5000).optional(),
  economicSensitivity: z.number().min(0).max(100).optional(),
  propertyRiskTolerance: z.record(z.string(), z.number().min(0).max(100)).optional()
});

export async function GET(_request: Request) {
  void _request;
  return NextResponse.json({ profile: getOperatingProfileInSingleton() });
}

export async function PATCH(request: Request) {
  try {
    const parsed = updateOperatingProfileSchema.parse(await request.json());
    return NextResponse.json({ profile: updateOperatingProfileInSingleton(parsed) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/operating-profile' });
  }
}
