import OpenAI from 'openai';
import { and, eq, asc } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  reservations,
  messages,
  guests,
  properties,
  scoringRules,
  reviews,
} from '@walt/db';

type ScoringResult = { score: number; summary: string };

type ThreadMessage = { sender: 'guest' | 'host'; body: string };

type PastReview = {
  rating: number | null;
  publicReview: string | null;
  privateFeedback: string | null;
};

type PromptInputs = {
  booking: {
    guestName: string;
    guestCount: {
      total: number | null;
      adults: number | null;
      children: number | null;
      infants: number | null;
      pets: number | null;
    };
    nights: number | null;
    arrivalDayOfWeek: string | null;
    bookingLeadDays: number | null;
  };
  thread: ThreadMessage[];
  propertyHouseRules: string | null;
  scoringRules: string[];
  internalHistory: string | null;
  pastReviews: PastReview[];
};

const CHAR_BUDGET = 8000;
const MIN_RECENT_MESSAGES = 20;
const REVIEW_SNIPPET_MAX = 300;
const MAX_REVIEWS = 5;

export function buildScoringPrompt(inputs: PromptInputs): string {
  const sections: string[] = [];

  sections.push(
    'You are a short-term rental risk assessor. Score this guest 1-10.\n' +
      '10 = ideal, 1 = high risk. Respond ONLY as JSON: {"score": <1-10>, "summary": "<string>"}.',
  );

  if (inputs.propertyHouseRules) {
    sections.push(
      `PROPERTY HOUSE RULES (what the guest is asked to accept):\n${inputs.propertyHouseRules}`,
    );
  }

  if (inputs.scoringRules.length > 0) {
    const bullets = inputs.scoringRules.map((r) => `- ${r}`).join('\n');
    sections.push(`HOST RULES AND RED FLAGS (weigh heavily):\n${bullets}`);
  }

  const b = inputs.booking;
  const bookingLines = [
    `- Guest name: ${b.guestName || 'Unknown'}`,
    `- Guest count: ${b.guestCount.total ?? 'unknown'} total (${b.guestCount.adults ?? '?'} adults, ${b.guestCount.children ?? '?'} children, ${b.guestCount.infants ?? '?'} infants, ${b.guestCount.pets ?? '?'} pets)`,
    `- Nights: ${b.nights ?? 'unknown'}`,
    `- Arrival: ${b.arrivalDayOfWeek ?? 'unknown'}, lead time: ${b.bookingLeadDays !== null ? `${b.bookingLeadDays} days` : 'unknown'}`,
  ];
  sections.push(`BOOKING:\n${bookingLines.join('\n')}`);

  if (inputs.thread.length > 0) {
    const trimmed = trimThread(inputs.thread);
    const formatted = trimmed.map((m) => `[${m.sender}] ${m.body}`).join('\n');
    sections.push(`CONVERSATION SO FAR:\n${formatted}`);
  }

  const historyParts: string[] = [];
  if (inputs.internalHistory) historyParts.push(`- Internal notes: ${inputs.internalHistory}`);
  if (inputs.pastReviews.length > 0) {
    const reviewLines = inputs.pastReviews.slice(0, MAX_REVIEWS).map((r) => {
      const star = r.rating != null ? `*${r.rating}` : '*?';
      const text = (r.publicReview ?? r.privateFeedback ?? '').slice(0, REVIEW_SNIPPET_MAX);
      return `  * ${star} - "${text}"`;
    });
    historyParts.push(`- Past reviews:\n${reviewLines.join('\n')}`);
  }
  if (historyParts.length > 0) {
    sections.push(`GUEST HISTORY:\n${historyParts.join('\n')}`);
  }

  return sections.join('\n\n');
}

function trimThread(thread: ThreadMessage[]): ThreadMessage[] {
  if (thread.length <= MIN_RECENT_MESSAGES) return thread;

  const recent = thread.slice(-MIN_RECENT_MESSAGES);
  const older = thread.slice(0, -MIN_RECENT_MESSAGES);
  let budget = CHAR_BUDGET - totalChars(recent);
  const keptOlder: ThreadMessage[] = [];
  for (let i = older.length - 1; i >= 0; i -= 1) {
    const m = older[i]!;
    const cost = m.body.length + 16;
    if (cost > budget) break;
    budget -= cost;
    keptOlder.unshift(m);
  }
  return [...keptOlder, ...recent];
}

function totalChars(msgs: ThreadMessage[]): number {
  return msgs.reduce((sum, m) => sum + m.body.length + 16, 0);
}

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
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);
  if (!reservation) return null;

  const raw = (reservation.raw ?? {}) as Record<string, unknown>;

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

  const guestName = [reservation.guestFirstName, reservation.guestLastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const threadRows = await db
    .select({ senderType: messages.senderType, body: messages.body })
    .from(messages)
    .where(eq(messages.reservationId, reservationId))
    .orderBy(asc(messages.createdAt));
  const thread: ThreadMessage[] = threadRows
    .filter((m) => m.body && (m.senderType === 'guest' || m.senderType === 'host'))
    .map((m) => ({ sender: m.senderType as 'guest' | 'host', body: m.body as string }));

  let propertyHouseRules: string | null = null;
  if (reservation.propertyId) {
    const [prop] = await db
      .select({ houseRules: properties.houseRules })
      .from(properties)
      .where(eq(properties.id, reservation.propertyId))
      .limit(1);
    propertyHouseRules = prop?.houseRules ?? null;
  }

  let internalHistory: string | null = null;
  if (reservation.guestFirstName && reservation.guestLastName) {
    const [existingGuest] = await db
      .select({ rating: guests.rating, hostAgain: guests.hostAgain, notes: guests.notes })
      .from(guests)
      .where(
        and(
          eq(guests.firstName, reservation.guestFirstName),
          eq(guests.lastName, reservation.guestLastName),
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

  let pastReviews: PastReview[] = [];
  if (reservation.guestFirstName && reservation.guestLastName) {
    pastReviews = await db
      .select({
        rating: reviews.rating,
        publicReview: reviews.publicReview,
        privateFeedback: reviews.privateFeedback,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.guestFirstName, reservation.guestFirstName),
          eq(reviews.guestLastName, reservation.guestLastName),
        ),
      );
  }

  const activeRules = await db
    .select({ ruleText: scoringRules.ruleText })
    .from(scoringRules)
    .where(eq(scoringRules.active, true));

  const prompt = buildScoringPrompt({
    booking: {
      guestName,
      guestCount: extractGuestCount(raw),
      nights: reservation.nights ?? null,
      arrivalDayOfWeek,
      bookingLeadDays,
    },
    thread,
    propertyHouseRules,
    scoringRules: activeRules.map((r) => r.ruleText),
    internalHistory,
    pastReviews,
  });

  const openai = new OpenAI();
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
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
