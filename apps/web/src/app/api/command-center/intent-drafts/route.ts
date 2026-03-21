import { z } from 'zod';
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';

import {
  createIntentDraftInSingleton,
  getIntentTaxonomyInSingleton,
} from '@/lib/command-center-store';

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
  'accusation',
]);

const createIntentDraftSchema = z.object({
  propertyId: z.string().min(1),
  reservationId: z.string().min(1),
  intent: intentSchema,
  guestName: z.string().min(1),
});

export const GET = withPermission('inbox.read', async () => {
  return NextResponse.json({ intents: getIntentTaxonomyInSingleton() });
});

export const POST = withPermission(
  'inbox.create',
  async (request: Request, _context, authContext) => {
    try {
      const rawBody = (await request.json()) as { actorId?: unknown };
      const parsed = createIntentDraftSchema.parse(rawBody);
      const actorId =
        process.env.NODE_ENV !== 'production' &&
        typeof rawBody.actorId === 'string' &&
        rawBody.actorId.length > 0
          ? rawBody.actorId
          : authContext.userId;
      return NextResponse.json(createIntentDraftInSingleton({ ...parsed, actorId }));
    } catch (error) {
      return handleApiError({ error, route: '/api/command-center/intent-drafts' });
    }
  },
);
