import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { assessRiskTrustIntelligenceInSingleton } from '@/lib/command-center-store';

const inputSchema = z.object({
  propertyId: z.string().min(1),
  bookingPatternSignals: z.number().min(0).max(100),
  profileQualitySignals: z.number().min(0).max(100),
  languageCues: z.number().min(0).max(100),
  policyViolationFlags: z.number().min(0).max(100),
  positiveReviewHistory: z.number().min(0).max(100),
  responseQuality: z.number().min(0).max(100),
  explicitRuleAcceptance: z.number().min(0).max(100)
});

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.parse(await request.json());
    return NextResponse.json({ assessment: assessRiskTrustIntelligenceInSingleton(parsed) });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/risk-intelligence' });
  }
}
