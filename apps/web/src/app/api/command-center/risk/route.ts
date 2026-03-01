import { riskRecommendationInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { getRiskRecommendation } from '@/lib/command-center-store';

export async function POST(request: Request) {
  try {
    const parsed = riskRecommendationInputSchema.parse(await request.json());
    return NextResponse.json({ recommendation: getRiskRecommendation(parsed) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/risk' });
  }
}
