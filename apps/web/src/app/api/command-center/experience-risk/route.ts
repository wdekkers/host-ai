import { experienceRiskInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { getExperienceRiskAssessment } from '@/lib/command-center-store';

export async function POST(request: Request) {
  try {
    const parsed = experienceRiskInputSchema.parse(await request.json());
    return NextResponse.json(getExperienceRiskAssessment(parsed));
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/experience-risk' });
  }
}
