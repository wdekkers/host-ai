import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

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

      // Merge any inquiry stub that was created before the reservation was confirmed.
      // When an inquiry message arrives before reservation.created fires, we create a stub
      // reservation keyed by conversation_id. Once the real reservation arrives, migrate
      // the stub's messages to the real reservation ID and remove the stub.
      if (normalized.conversationId) {
        const [stub] = await db
          .select({ id: reservations.id })
          .from(reservations)
          .where(eq(reservations.conversationId, normalized.conversationId))
          .limit(1);

        if (stub && stub.id !== normalized.id) {
          await db
            .update(messages)
            .set({ reservationId: normalized.id })
            .where(eq(messages.reservationId, stub.id));
          await db.delete(reservations).where(eq(reservations.id, stub.id));
          log('info', 'webhook_inquiry_stub_merged', {
            correlationId,
            stubId: stub.id,
            reservationId: normalized.id,
          });
        }
      }

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
      const rawReservationId =
        typeof data.reservation_id === 'string' && data.reservation_id.trim()
          ? data.reservation_id.trim()
          : null;
      const conversationId =
        typeof data.conversation_id === 'string' && data.conversation_id.trim()
          ? data.conversation_id.trim()
          : null;

      let reservationId: string | null = rawReservationId;

      // Inquiry messages have no reservation_id yet — resolve via conversation_id
      if (!reservationId && conversationId) {
        const [existing] = await db
          .select({ id: reservations.id })
          .from(reservations)
          .where(eq(reservations.conversationId, conversationId))
          .limit(1);

        if (existing) {
          reservationId = existing.id;
        } else {
          // Create a stub reservation so messages can be stored (FK requires a reservation row).
          // When reservation.created fires later (on booking), the stub is merged into the real one.
          const stubId = uuidv4();
          const sender =
            data.sender && typeof data.sender === 'object'
              ? (data.sender as Record<string, unknown>)
              : {};
          const property =
            data.property && typeof data.property === 'object'
              ? (data.property as Record<string, unknown>)
              : {};
          const senderType = typeof data.sender_type === 'string' ? data.sender_type : 'guest';
          const isGuest = senderType === 'guest';

          const firstName = isGuest
            ? typeof sender.first_name === 'string'
              ? sender.first_name.trim() || null
              : null
            : null;
          const fullName = typeof sender.full_name === 'string' ? sender.full_name.trim() : '';
          const lastName =
            isGuest && firstName && fullName.startsWith(firstName)
              ? fullName.slice(firstName.length).trim() || null
              : null;

          await db.insert(reservations).values({
            id: stubId,
            conversationId,
            platform: typeof data.platform === 'string' ? data.platform : null,
            status: 'inquiry',
            guestFirstName: firstName,
            guestLastName: lastName,
            propertyId: typeof property.id === 'string' ? property.id : null,
            propertyName: typeof property.name === 'string' ? property.name : null,
            raw: data,
            syncedAt: now,
          });

          reservationId = stubId;
          log('info', 'webhook_inquiry_stub_created', {
            correlationId,
            conversationId,
            stubId,
          });
        }
      }

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
