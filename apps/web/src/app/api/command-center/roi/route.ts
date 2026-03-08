import { roiUpdateInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import {
  getRoiMetricsInSingleton,
  recordGuestReviewInSingleton,
  recordRefundInSingleton,
} from '@/lib/command-center-store';

export async function GET() {
  return NextResponse.json({ metrics: getRoiMetricsInSingleton() });
}

export async function POST(request: Request) {
  try {
    const parsed = roiUpdateInputSchema.parse(await request.json());
    const metrics =
      parsed.action === 'refund'
        ? recordRefundInSingleton(parsed.amount)
        : recordGuestReviewInSingleton(parsed.rating);

    return NextResponse.json({ metrics });
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/roi' });
  }
}
