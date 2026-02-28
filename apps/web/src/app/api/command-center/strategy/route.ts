import { strategyRecommendationInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { getStrategyRecommendation } from '@/lib/command-center-store';

export async function POST(request: Request) {
  try {
    const parsed = strategyRecommendationInputSchema.parse(await request.json());
    return NextResponse.json({ recommendation: getStrategyRecommendation(parsed) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
