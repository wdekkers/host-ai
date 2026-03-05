import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';
import { ingestHospitableMessageInSingleton } from '@/lib/command-center-store';

const hospitableWebhookSchema = z.object({
  eventId: z.string().min(1),
  reservationId: z.string().min(1),
  guestName: z.string().min(1),
  message: z.string().min(1),
  sentAt: z.string().datetime().optional()
});

function verifyHospitableWebhookSignature(request: Request, rawBody: string) {
  const secret = process.env.HOSPITABLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return;
  }

  const timestamp = request.headers.get('x-hospitable-timestamp');
  const signature = request.headers.get('x-hospitable-signature');
  if (!timestamp || !signature) {
    throw new Error('Missing webhook signature headers');
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const providedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Invalid webhook signature');
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    verifyHospitableWebhookSignature(request, rawBody);
    const body = JSON.parse(rawBody) as unknown;
    const parsed = hospitableWebhookSchema.parse(body);
    const { item, duplicated } = ingestHospitableMessageInSingleton(parsed);
    return NextResponse.json({ item, duplicated }, { status: duplicated ? 200 : 202 });
  } catch (error) {
    const status =
      error instanceof Error && (error.message === 'Missing webhook signature headers' || error.message === 'Invalid webhook signature')
        ? 401
        : 400;
    return handleApiError({ error, route: '/api/integrations/hospitable', status });
  }
}
