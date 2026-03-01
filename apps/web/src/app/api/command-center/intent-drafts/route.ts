import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { createIntentDraftInSingleton, getIntentTaxonomyInSingleton } from '@/lib/command-center-store';

const intentSchema = z.enum([
  'booking-inquiry',
  'rules-acknowledgment',
  'arrival-checkin',
  'checkout-guidance',
  'pool-help',
  'early-check-in-request',
  'late-checkout-request',
  'spa-help',
  'sauna-help',
  'refund-request',
  'threat',
  'injury',
  'accusation'
]);

const createIntentDraftSchema = z.object({
  propertyId: z.string().min(1),
  reservationId: z.string().min(1),
  intent: intentSchema,
  guestName: z.string().min(1),
  actorId: z.string().min(1).optional()
});

export async function GET() {
  return NextResponse.json({ intents: getIntentTaxonomyInSingleton() });
}

export async function POST(request: Request) {
  try {
    const parsed = createIntentDraftSchema.parse(await request.json());
    return NextResponse.json(createIntentDraftInSingleton(parsed));
  } catch (error) {
    return handleApiError({ error, route: '/api/command-center/intent-drafts' });
  }
}
