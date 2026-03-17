import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { handleApiError, log } from '@/lib/secure-logger';

import { ingestHospitableMessageInSingleton } from '@/lib/command-center-store';
import { getHospitableWebhookSecret } from '@/lib/integrations-env';

// Hospitable v2 webhook envelope:
//   { id, action, created, version, data }
// For message.created, data is MessageFull:
//   { id, body, sender: { full_name, first_name }, reservation_id, ... }
const hospitableEnvelopeSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  created: z.string().optional(),
  data: z.record(z.unknown()),
});

export async function POST(request: Request) {
  const correlationId = uuidv4();
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
        return NextResponse.json(
          { error: 'Webhook timestamp is outside the allowed window.' },
          { status: 401 },
        );
      }

      const expectedSignature = createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');
      const receivedBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);
      if (
        receivedBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(receivedBuffer, expectedBuffer)
      ) {
        return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
      }
    }

    const envelope = hospitableEnvelopeSchema.parse(JSON.parse(rawBody));

    log('info', 'webhook_received', {
      correlationId,
      action: envelope.action,
      eventId: envelope.id,
      dataKeys: Object.keys(envelope.data),
    });

    // Only the command center cares about new guest messages
    if (envelope.action !== 'message.created') {
      log('info', 'webhook_ignored', { correlationId, action: envelope.action });
      return NextResponse.json({ ignored: true, action: envelope.action }, { status: 200 });
    }

    const data = envelope.data;

    const message = typeof data.body === 'string' ? data.body.trim() : '';
    if (!message) {
      log('warn', 'webhook_empty_body', { correlationId, eventId: envelope.id });
      return NextResponse.json({ error: 'Message body is empty.' }, { status: 400 });
    }

    const sender =
      data.sender && typeof data.sender === 'object'
        ? (data.sender as Record<string, unknown>)
        : {};
    const guestName =
      typeof sender.full_name === 'string' && sender.full_name.trim()
        ? sender.full_name.trim()
        : typeof sender.first_name === 'string' && sender.first_name.trim()
          ? sender.first_name.trim()
          : 'Guest';

    // reservation_id is the primary link; fall back to conversation_id
    const reservationId =
      typeof data.reservation_id === 'string' && data.reservation_id.trim()
        ? data.reservation_id.trim()
        : typeof data.conversation_id === 'string' && data.conversation_id.trim()
          ? data.conversation_id.trim()
          : null;

    if (!reservationId) {
      // Log full data keys so we can find the right field name
      log('warn', 'webhook_no_reservation_id', {
        correlationId,
        eventId: envelope.id,
        dataKeys: Object.keys(data),
        dataSnapshot: JSON.stringify(data).slice(0, 500),
      });
      return NextResponse.json(
        { error: 'Cannot determine reservationId from webhook.' },
        { status: 400 },
      );
    }

    const input = {
      eventId: envelope.id,
      reservationId,
      guestName,
      message,
      sentAt: envelope.created,
    };

    const { item, duplicated } = ingestHospitableMessageInSingleton(input);

    log('info', duplicated ? 'webhook_duplicate' : 'webhook_ingested', {
      correlationId,
      eventId: input.eventId,
      reservationId: input.reservationId,
      guestName: input.guestName,
      queueItemId: item.id,
      intent: item.intent,
    });

    return NextResponse.json({ item, duplicated }, { status: duplicated ? 200 : 202 });
  } catch (error) {
    return handleApiError({
      error,
      route: '/api/integrations/hospitable',
      context: { correlationId },
    });
  }
}
