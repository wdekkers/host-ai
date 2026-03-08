import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { reservations, messages } from '@walt/db';
import { eq } from 'drizzle-orm';

import { handleApiError, log } from '@/lib/secure-logger';
import { getHospitableApiConfig } from '@/lib/integrations-env';
import { db } from '@/lib/db';
import { normalizeReservation, normalizeMessage } from '@/lib/hospitable-normalize';
import { generateReplySuggestion } from '@/lib/generate-reply-suggestion';

const webhookSchema = z.object({
  reservationId: z.string().min(1),
  message: z.string().min(1),
  senderType: z.string().default('guest'),
  senderName: z.string().optional(),
  sentAt: z.string().optional(),
});

function verifySignature(request: Request, rawBody: string) {
  const secret = process.env.HOSPITABLE_WEBHOOK_SECRET?.trim();
  if (!secret) return;
  const timestamp = request.headers.get('x-hospitable-timestamp');
  const signature = request.headers.get('x-hospitable-signature');
  if (!timestamp || !signature) throw new Error('Missing webhook signature headers');
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const providedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid webhook signature');
  }
}

async function fetchReservation(
  config: { apiKey: string; baseUrl: string },
  reservationId: string,
) {
  const url = new URL(
    `/v2/reservations/${reservationId}?includes[]=guest&includes[]=properties`,
    config.baseUrl,
  );
  const res = await fetch(url, {
    headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: Record<string, unknown> };
  return body.data ?? null;
}

export async function POST(request: Request) {
  const eventId = uuidv4();
  const route = '/api/integrations/hospitable';

  try {
    const rawBody = await request.text();
    verifySignature(request, rawBody);

    const body = JSON.parse(rawBody) as unknown;
    const parsed = webhookSchema.parse(body);

    log('info', 'webhook_received', {
      eventId,
      route,
      reservationId: parsed.reservationId,
      senderType: parsed.senderType,
      sentAt: parsed.sentAt ?? null,
    });

    const config = getHospitableApiConfig();

    let reservationRaw: Record<string, unknown> | null = null;
    if (config) {
      reservationRaw = await fetchReservation(config, parsed.reservationId);
      if (reservationRaw) {
        const normalized = normalizeReservation(reservationRaw);
        await db
          .insert(reservations)
          .values({ ...normalized, syncedAt: new Date() })
          .onConflictDoUpdate({
            target: reservations.id,
            set: { ...normalized, syncedAt: new Date() },
          });
        log('info', 'reservation_upserted', { eventId, reservationId: parsed.reservationId });
      } else {
        log('warn', 'reservation_fetch_failed', { eventId, reservationId: parsed.reservationId });
      }
    } else {
      log('warn', 'reservation_fetch_skipped', {
        eventId,
        reservationId: parsed.reservationId,
        reason: 'no_hospitable_config',
      });
    }

    const msgRaw: Record<string, unknown> = {
      reservation_id: parsed.reservationId,
      body: parsed.message,
      sender_type: parsed.senderType,
      sender: { full_name: parsed.senderName ?? '' },
      created_at: parsed.sentAt ?? new Date().toISOString(),
    };
    const normalizedMsg = normalizeMessage(msgRaw, parsed.reservationId);

    if (!normalizedMsg) {
      log('warn', 'message_skip', {
        eventId,
        reservationId: parsed.reservationId,
        reason: 'normalize_returned_null',
        senderType: parsed.senderType,
      });
      return NextResponse.json({ ok: true }, { status: 202 });
    }

    const msgId = uuidv4();
    await db
      .insert(messages)
      .values({ id: msgId, ...normalizedMsg })
      .onConflictDoNothing();

    log('info', 'message_inserted', {
      eventId,
      messageId: msgId,
      reservationId: parsed.reservationId,
      senderType: parsed.senderType,
    });

    if (parsed.senderType === 'guest' && reservationRaw) {
      const guest = reservationRaw.guest as Record<string, unknown> | undefined;
      const props = reservationRaw.properties as Record<string, unknown>[] | undefined;
      const propId = (props?.[0]?.id as string | null) ?? null;
      const suggestion = await generateReplySuggestion({
        guestName: String(guest?.first_name ?? 'the guest'),
        propertyName: String(props?.[0]?.name ?? 'the property'),
        propertyId: propId,
        checkIn: reservationRaw.check_in as string | null,
        checkOut: reservationRaw.check_out as string | null,
        messageBody: parsed.message,
      });
      if (suggestion) {
        await db
          .update(messages)
          .set({ suggestion, suggestionGeneratedAt: new Date() })
          .where(eq(messages.id, msgId));
        log('info', 'suggestion_generated', { eventId, messageId: msgId });
      } else {
        log('warn', 'suggestion_skip', {
          eventId,
          messageId: msgId,
          reason: 'generate_returned_null',
        });
      }
    } else {
      log('info', 'suggestion_skip', {
        eventId,
        messageId: msgId,
        reason: parsed.senderType !== 'guest' ? 'sender_not_guest' : 'no_reservation_data',
      });
    }

    log('info', 'webhook_processed', { eventId, reservationId: parsed.reservationId });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    const status =
      error instanceof Error &&
      (error.message === 'Missing webhook signature headers' ||
        error.message === 'Invalid webhook signature')
        ? 401
        : 400;
    return handleApiError({ error, route, status, context: { eventId } });
  }
}
