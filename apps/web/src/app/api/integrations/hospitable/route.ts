import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { reservations, messages, propertyFaqs } from '@walt/db';
import { eq } from 'drizzle-orm';

import { handleApiError } from '@/lib/secure-logger';
import { getHospitableApiConfig } from '@/lib/integrations-env';
import { db } from '@/lib/db';
import { normalizeReservation, normalizeMessage } from '@/lib/hospitable-normalize';

const webhookSchema = z.object({
  reservationId: z.string().min(1),
  message: z.string().min(1),
  senderType: z.string().default('guest'),
  senderName: z.string().optional(),
  sentAt: z.string().optional()
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
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Invalid webhook signature');
  }
}

async function fetchReservation(config: { apiKey: string; baseUrl: string }, reservationId: string) {
  const url = new URL(`/v1/reservations/${reservationId}?includes[]=guest&includes[]=properties`, config.baseUrl);
  const res = await fetch(url, {
    headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: Record<string, unknown> };
  return body.data ?? null;
}

async function generateSuggestion(
  reservation: Record<string, unknown>,
  messageBody: string,
  propertyId: string | null
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const guest = reservation.guest as Record<string, unknown> | undefined;
  const props = reservation.properties as Record<string, unknown>[] | undefined;
  const guestName = String(guest?.first_name ?? 'the guest');
  const propertyName = String(props?.[0]?.name ?? 'the property');
  const checkIn = reservation.check_in ? new Date(reservation.check_in as string).toLocaleDateString() : 'unknown';
  const checkOut = reservation.check_out ? new Date(reservation.check_out as string).toLocaleDateString() : 'unknown';

  // Load property FAQs for context
  let faqContext = '';
  if (propertyId) {
    const faqs = await db
      .select({ category: propertyFaqs.category, answer: propertyFaqs.answer })
      .from(propertyFaqs)
      .where(eq(propertyFaqs.propertyId, propertyId));
    if (faqs.length > 0) {
      const faqLines = faqs
        .filter((f) => f.answer)
        .map((f) => `Q: ${f.category}\nA: ${f.answer}`)
        .join('\n\n');
      if (faqLines) {
        faqContext = `\n\nKnowledge base for this property:\n${faqLines}`;
      }
    }
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: `You are a helpful short-term rental host assistant. Draft a warm, concise reply to a guest message.
Property: ${propertyName}
Guest: ${guestName}
Check-in: ${checkIn}
Check-out: ${checkOut}
Reply in the same language as the guest message. Keep it under 3 sentences unless the question requires more detail.${faqContext}`
      },
      { role: 'user', content: messageBody }
    ]
  });

  return response.choices[0]?.message?.content ?? null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    verifySignature(request, rawBody);

    const body = JSON.parse(rawBody) as unknown;
    const parsed = webhookSchema.parse(body);
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
            set: { ...normalized, syncedAt: new Date() }
          });
      }
    }

    const msgRaw: Record<string, unknown> = {
      reservation_id: parsed.reservationId,
      body: parsed.message,
      sender_type: parsed.senderType,
      sender: { full_name: parsed.senderName ?? '' },
      created_at: parsed.sentAt ?? new Date().toISOString()
    };
    const normalizedMsg = normalizeMessage(msgRaw, parsed.reservationId);

    if (normalizedMsg) {
      const msgId = uuidv4();
      await db
        .insert(messages)
        .values({ id: msgId, ...normalizedMsg })
        .onConflictDoNothing();

      if (parsed.senderType === 'guest' && reservationRaw) {
        const propId = (reservationRaw.properties as Record<string, unknown>[] | undefined)?.[0]?.id as string | null ?? null;
        const suggestion = await generateSuggestion(reservationRaw, parsed.message, propId);
        if (suggestion) {
          await db
            .update(messages)
            .set({ suggestion, suggestionGeneratedAt: new Date() })
            .where(eq(messages.id, msgId));
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    const status =
      error instanceof Error &&
      (error.message === 'Missing webhook signature headers' || error.message === 'Invalid webhook signature')
        ? 401
        : 400;
    return handleApiError({ error, route: '/api/integrations/hospitable', status });
  }
}
