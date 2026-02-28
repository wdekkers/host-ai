import { riskRecommendationInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { getRiskRecommendation } from '@/lib/command-center-store';

export async function POST(request: Request) {
  try {
    const parsed = riskRecommendationInputSchema.parse(await request.json());
    return NextResponse.json({ recommendation: getRiskRecommendation(parsed) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
