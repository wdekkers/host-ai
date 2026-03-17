import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { handleApiError, log } from '@/lib/secure-logger';
import { ingestHospitableMessageInSingleton } from '@/lib/command-center-store';
import { getHospitableWebhookSecret } from '@/lib/integrations-env';
import {
  normalizeReservation,
  normalizeProperty,
  normalizeReview,
  normalizeMessage,
} from '@/lib/hospitable-normalize';
import { db } from '@/lib/db';
import { properties, reservations, messages, reviews } from '@walt/db';

// Hospitable v2 webhook envelope: { id, action, created, version, data }
const hospitableEnvelopeSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  created: z.string().optional(),
  data: z.record(z.unknown()),
});

function verifySignature(secret: string, rawBody: string, request: Request): Response | null {
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
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const receivedBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (receivedBuf.length !== expectedBuf.length || !timingSafeEqual(receivedBuf, expectedBuf)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const correlationId = uuidv4();
  try {
    const rawBody = await request.text();
    const secret = getHospitableWebhookSecret();

    if (secret) {
      const err = verifySignature(secret, rawBody, request);
      if (err) return err;
    }

    const envelope = hospitableEnvelopeSchema.parse(JSON.parse(rawBody));
    const { id: eventId, action, data, created } = envelope;
    const now = new Date();

    log('info', 'webhook_received', { correlationId, action, eventId });

    // --- property.created / property.changed ---
    if (action === 'property.created' || action === 'property.changed') {
      const normalized = normalizeProperty(data);
      await db
        .insert(properties)
        .values({ ...normalized, syncedAt: now })
        .onConflictDoUpdate({ target: properties.id, set: { ...normalized, syncedAt: now } });
      log('info', 'webhook_property_upserted', { correlationId, propertyId: normalized.id });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // --- reservation.created / reservation.changed ---
    if (action === 'reservation.created' || action === 'reservation.changed') {
      const normalized = normalizeReservation(data);
      await db
        .insert(reservations)
        .values({ ...normalized, syncedAt: now })
        .onConflictDoUpdate({ target: reservations.id, set: { ...normalized, syncedAt: now } });
      log('info', 'webhook_reservation_upserted', {
        correlationId,
        reservationId: normalized.id,
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // --- review.created ---
    if (action === 'review.created') {
      const normalized = normalizeReview(data);
      if (normalized) {
        await db
          .insert(reviews)
          .values({ ...normalized, syncedAt: now })
          .onConflictDoUpdate({ target: reviews.id, set: { ...normalized, syncedAt: now } });
        log('info', 'webhook_review_upserted', { correlationId, reviewId: normalized.id });
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // --- message.created ---
    if (action === 'message.created') {
      const reservationId =
        typeof data.reservation_id === 'string' && data.reservation_id.trim()
          ? data.reservation_id.trim()
          : typeof data.conversation_id === 'string' && data.conversation_id.trim()
            ? data.conversation_id.trim()
            : null;

      if (!reservationId) {
        log('warn', 'webhook_no_reservation_id', { correlationId, eventId });
        return NextResponse.json(
          { error: 'Cannot determine reservationId from webhook.' },
          { status: 400 },
        );
      }

      // Persist to messages table
      const normalizedMsg = normalizeMessage(data, reservationId);
      if (normalizedMsg) {
        await db
          .insert(messages)
          .values({ id: uuidv4(), ...normalizedMsg })
          .onConflictDoNothing();
      }

      // Feed command center (real-time inbox)
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
      const messageBody = typeof data.body === 'string' ? data.body.trim() : '';

      if (messageBody) {
        const { item, duplicated } = ingestHospitableMessageInSingleton({
          eventId,
          reservationId,
          guestName,
          message: messageBody,
          sentAt: created,
        });
        log('info', duplicated ? 'webhook_duplicate' : 'webhook_ingested', {
          correlationId,
          eventId,
          reservationId,
          guestName,
          queueItemId: item.id,
          intent: item.intent,
        });
        return NextResponse.json({ item, duplicated }, { status: duplicated ? 200 : 202 });
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Unknown action — acknowledge and ignore
    log('info', 'webhook_ignored', { correlationId, action });
    return NextResponse.json({ ignored: true, action }, { status: 200 });
  } catch (error) {
    return handleApiError({
      error,
      route: '/api/integrations/hospitable',
      context: { correlationId },
    });
  }
}
