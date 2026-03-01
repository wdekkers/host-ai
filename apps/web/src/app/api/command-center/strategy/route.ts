import { strategyRecommendationInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { getStrategyRecommendation } from '@/lib/command-center-store';

export async function POST(request: Request) {
  try {
    const parsed = strategyRecommendationInputSchema.parse(await request.json());
    return NextResponse.json({ recommendation: getStrategyRecommendation(parsed) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/strategy' });
  }
}
