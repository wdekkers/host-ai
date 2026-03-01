import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/secure-logger';

import { ingestHospitableMessageInSingleton } from '@/lib/command-center-store';
import { getHospitableWebhookSecret } from '@/lib/integrations-env';

const hospitableWebhookSchema = z.object({
  eventId: z.string().min(1),
  reservationId: z.string().min(1),
  guestName: z.string().min(1),
  message: z.string().min(1),
  sentAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const secret = getHospitableWebhookSecret();

    if (secret) {
      const timestamp = request.headers.get('x-hospitable-timestamp');
      const signature = request.headers.get('x-hospitable-signature');
      if (!timestamp || !signature) {
        return NextResponse.json({ error: 'Missing webhook signature headers.' }, { status: 401 });
      }

      const parsedTimestamp = Number(timestamp);
      if (!Number.isFinite(parsedTimestamp)) {
        return NextResponse.json({ error: 'Invalid webhook timestamp.' }, { status: 401 });
      }

      const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - parsedTimestamp);
      if (ageSeconds > 300) {
        return NextResponse.json({ error: 'Webhook timestamp is outside the allowed window.' }, { status: 401 });
      }

      const expectedSignature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const receivedBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);
      if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
        return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
      }
    }

    const parsed = hospitableWebhookSchema.parse(JSON.parse(rawBody));
    const { item, duplicated } = ingestHospitableMessageInSingleton(parsed);
    return NextResponse.json({ item, duplicated }, { status: duplicated ? 200 : 202 });
  } catch (error) {
    return handleApiError({ error, route: '/api/integrations/hospitable' });
  }
}
