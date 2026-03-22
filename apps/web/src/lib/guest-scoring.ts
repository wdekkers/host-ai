import OpenAI from 'openai';
import { and, eq, asc } from 'drizzle-orm';

import { db } from '@/lib/db';
import { reservations, messages, guests } from '@walt/db';

type ScoringResult = {
  score: number;
  summary: string;
};

function extractGuestCount(raw: Record<string, unknown>): {
  total: number | null;
  adults: number | null;
  children: number | null;
  infants: number | null;
  pets: number | null;
} {
  const g = (raw.guests ?? {}) as Record<string, unknown>;
  return {
    total: typeof g.total === 'number' ? g.total : null,
    adults: typeof g.adult_count === 'number' ? g.adult_count : null,
    children: typeof g.child_count === 'number' ? g.child_count : null,
    infants: typeof g.infant_count === 'number' ? g.infant_count : null,
    pets: typeof g.pet_count === 'number' ? g.pet_count : null,
  };
}

export async function scoreGuest(reservationId: string): Promise<ScoringResult | null> {
  // 1. Fetch reservation
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!reservation) return null;

  const raw = (reservation.raw ?? {}) as Record<string, unknown>;

  // 2. Extract signals
  const guestCount = extractGuestCount(raw);

  const bookingLeadDays =
    reservation.bookingDate && reservation.arrivalDate
      ? Math.round(
          (reservation.arrivalDate.getTime() - reservation.bookingDate.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  const arrivalDayOfWeek = reservation.arrivalDate
    ? reservation.arrivalDate.toLocaleDateString('en-US', { weekday: 'long' })
    : null;

  // 3. Get first guest message
  const [firstGuestMsg] = await db
    .select({ body: messages.body })
    .from(messages)
    .where(and(eq(messages.reservationId, reservationId), eq(messages.senderType, 'guest')))
    .orderBy(asc(messages.createdAt))
    .limit(1);

  const firstGuestMessage = firstGuestMsg?.body ?? null;

  // 4. Look up internal guest history
  let internalHistory: string = 'No prior history found.';
  const guestName = [reservation.guestFirstName, reservation.guestLastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (guestName) {
    const [existingGuest] = await db
      .select({
        rating: guests.rating,
        hostAgain: guests.hostAgain,
        notes: guests.notes,
      })
      .from(guests)
      .where(
        and(
          eq(guests.firstName, reservation.guestFirstName ?? ''),
          eq(guests.lastName, reservation.guestLastName ?? ''),
        ),
      )
      .limit(1);

    if (existingGuest) {
      const parts: string[] = [];
      if (existingGuest.rating) parts.push(`Past rating: ${existingGuest.rating}/5`);
      parts.push(`Host again: ${existingGuest.hostAgain}`);
      if (existingGuest.notes) parts.push(`Notes: ${existingGuest.notes}`);
      internalHistory = parts.join('. ');
    }
  }

  // 5. Build prompt and call AI
  const openai = new OpenAI();

  const prompt = `You are a short-term rental risk assessor helping a host evaluate an incoming booking.

Score the guest from 1 to 10:
- 10 = ideal guest (family, clear communicator, good history)
- 1 = high risk (party indicators, evasive, red flags)

Provide a 1-2 sentence advisory summary explaining the score.

Booking data:
- Guest name: ${guestName || 'Unknown'}
- Guest count: ${guestCount.total ?? 'unknown'} total (${guestCount.adults ?? '?'} adults, ${guestCount.children ?? '?'} children, ${guestCount.infants ?? '?'} infants, ${guestCount.pets ?? '?'} pets)
- Nights: ${reservation.nights ?? 'unknown'}
- Arrival: ${arrivalDayOfWeek ?? 'unknown'}, lead time: ${bookingLeadDays !== null ? `${bookingLeadDays} days` : 'unknown'}
- Guest message: ${firstGuestMessage ? `"${firstGuestMessage.slice(0, 500)}"` : 'No message yet'}
- Internal history: ${internalHistory}

Respond with ONLY valid JSON: {"score": <number 1-10>, "summary": "<string>"}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as { score: number; summary: string };
    const score = Math.max(1, Math.min(10, Math.round(parsed.score)));

    return { score, summary: parsed.summary };
  } catch {
    return null;
  }
}
