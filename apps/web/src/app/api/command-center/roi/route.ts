import { roiUpdateInputSchema } from '@walt/contracts';
import { NextResponse } from 'next/server';

import { getRoiMetricsInSingleton, recordGuestReviewInSingleton, recordRefundInSingleton } from '@/lib/command-center-store';

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
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
