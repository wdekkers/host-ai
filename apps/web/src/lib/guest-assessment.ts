import { createHash } from 'node:crypto';

import OpenAI from 'openai';
import { and, asc, desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  reservations,
  messages,
  properties,
  scoringRules,
  reviews,
  guestAssessments,
  guestIncidents,
} from '@walt/db';
import {
  loadEffectiveCatalog,
  type EffectiveSignal,
} from '@/lib/risk-signals-catalog';

export const PROMPT_VERSION = 'v1.0';
export const MODEL = 'gpt-4o-mini';

export type AssessmentTrigger =
  | 'booking_request'
  | 'inquiry'
  | 'new_message'
  | 'manual_rescore'
  | 'feedback'
  | 'backfill';

export type ThreadMessage = { sender: 'guest' | 'host'; body: string };

export type ConfirmedIncident = {
  type: string;
  severity: 'low' | 'medium' | 'high';
  notes: string | null;
  date: string | null;
};

export type PastReview = {
  rating: number | null;
  publicReview: string | null;
  privateFeedback: string | null;
};

export type AssessmentPromptInputs = {
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
  hostScoringRules: string[];
  effectiveCatalog: EffectiveSignal[];
  confirmedIncidents: ConfirmedIncident[];
  pastReviews: PastReview[];
};

export type Assessment = {
  score: number;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  trustLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  signals: Array<{ catalogItemId: string; explanation: string }>;
  rulesAcceptance: {
    requested: boolean;
    confirmed: boolean;
    confirmedAt: string | null;
    confirmationQuote: string | null;
  };
};

const CHAR_BUDGET = 8000;
const MIN_RECENT_MESSAGES = 20;
const REVIEW_SNIPPET_MAX = 300;
const MAX_REVIEWS = 5;
const DEBOUNCE_SECONDS = 30;

function totalChars(msgs: ThreadMessage[]): number {
  return msgs.reduce((sum, m) => sum + m.body.length + 16, 0);
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

export function buildAssessmentPrompt(inputs: AssessmentPromptInputs): string {
  const sections: string[] = [];

  sections.push(
    [
      'You are a short-term rental risk assessor.',
      '',
      'Return JSON ONLY in this shape:',
      '{',
      '  "score": <int 1-10>,                  // 7 = standard booking; 5 = friction but workable; 3 = serious concerns',
      '  "summary": "<paragraph>",',
      '  "risk_level": "low|medium|high",      // independent: how concerning are negative signals',
      '  "trust_level": "low|medium|high",     // independent: how strong is the positive history',
      '  "recommendation": "<one sentence — must articulate WHY>",',
      '  "signals": [{ "catalog_item_id": "<id>", "explanation": "<sentence citing evidence>" }],',
      '  "rules_acceptance": {',
      '    "requested": <bool>, "confirmed": <bool>,',
      '    "confirmed_at": "<iso or null>", "confirmation_quote": "<quote or null>"',
      '  }',
      '}',
      '',
      'Rules:',
      '- Only return signals from the SIGNAL CATALOG below; do not invent labels.',
      '- A 5-star public review does not override negative private_feedback or a confirmed incident.',
      '- "Rules accepted then violated" fires only if rules_acceptance.confirmed=true AND a confirmed incident exists.',
      '- "Rules acceptance never confirmed" fires only if rules_acceptance.requested=true AND confirmed=false.',
    ].join('\n'),
  );

  if (inputs.propertyHouseRules) {
    sections.push(`PROPERTY HOUSE RULES:\n${inputs.propertyHouseRules}`);
  }

  if (inputs.hostScoringRules.length > 0) {
    sections.push(
      `HOST RULES (free-text, complement to catalog):\n${inputs.hostScoringRules.map((r) => `- ${r}`).join('\n')}`,
    );
  }

  const catalogLines = inputs.effectiveCatalog
    .map(
      (s) =>
        `- {id: "${s.id}", label: "${s.label}", dimension: "${s.dimension}", severity: "${s.severity}", valence: "${s.valence}"}`,
    )
    .join('\n');
  sections.push(`SIGNAL CATALOG (return only items that apply):\n${catalogLines}`);

  if (inputs.confirmedIncidents.length > 0) {
    const lines = inputs.confirmedIncidents
      .map((i) => `- ${i.date ?? 'unknown date'} — ${i.type} (${i.severity}): ${i.notes ?? ''}`)
      .join('\n');
    sections.push(
      `PRIOR INCIDENTS FOR THIS GUEST (confirmed by host or extracted from reviews):\n${lines}`,
    );
  }

  if (inputs.pastReviews.length > 0) {
    const lines = inputs.pastReviews.slice(0, MAX_REVIEWS).map((r) => {
      const star = r.rating != null ? `★${r.rating}` : '★?';
      const pub = (r.publicReview ?? '').slice(0, REVIEW_SNIPPET_MAX);
      const priv = (r.privateFeedback ?? '').slice(0, REVIEW_SNIPPET_MAX);
      return `- ${star} public: "${pub}"; private: "${priv}"`;
    });
    sections.push(
      `PAST REVIEWS (private_feedback weighs more than public rating):\n${lines.join('\n')}`,
    );
  }

  const b = inputs.booking;
  sections.push(
    [
      'BOOKING:',
      `- Guest: ${b.guestName || 'Unknown'}`,
      `- Guest count: ${b.guestCount.total ?? '?'} total (${b.guestCount.adults ?? '?'} adults, ${b.guestCount.children ?? '?'} children, ${b.guestCount.infants ?? '?'} infants, ${b.guestCount.pets ?? '?'} pets)`,
      `- Nights: ${b.nights ?? '?'}`,
      `- Arrival: ${b.arrivalDayOfWeek ?? '?'}, lead time: ${b.bookingLeadDays ?? '?'} days`,
    ].join('\n'),
  );

  if (inputs.thread.length > 0) {
    const trimmed = trimThread(inputs.thread);
    sections.push(`CONVERSATION:\n${trimmed.map((m) => `[${m.sender}] ${m.body}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

export function computeInputsHash(inputs: AssessmentPromptInputs): string {
  const canonical = JSON.stringify(inputs, Object.keys(inputs).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

const responseSchema = z.object({
  score: z.number(),
  summary: z.string(),
  risk_level: z.enum(['low', 'medium', 'high']),
  trust_level: z.enum(['low', 'medium', 'high']),
  recommendation: z.string(),
  signals: z.array(z.object({ catalog_item_id: z.string(), explanation: z.string() })),
  rules_acceptance: z.object({
    requested: z.boolean(),
    confirmed: z.boolean(),
    confirmed_at: z.string().nullable(),
    confirmation_quote: z.string().nullable(),
  }),
});

export function parseAssessmentResponse(content: string): Assessment | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  const result = responseSchema.safeParse(parsed);
  if (!result.success) return null;
  const r = result.data;
  return {
    score: Math.max(1, Math.min(10, Math.round(r.score))),
    summary: r.summary,
    riskLevel: r.risk_level,
    trustLevel: r.trust_level,
    recommendation: r.recommendation,
    signals: r.signals.map((s) => ({ catalogItemId: s.catalog_item_id, explanation: s.explanation })),
    rulesAcceptance: {
      requested: r.rules_acceptance.requested,
      confirmed: r.rules_acceptance.confirmed,
      confirmedAt: r.rules_acceptance.confirmed_at,
      confirmationQuote: r.rules_acceptance.confirmation_quote,
    },
  };
}

function extractGuestCount(raw: Record<string, unknown>): AssessmentPromptInputs['booking']['guestCount'] {
  const g = (raw.guests ?? {}) as Record<string, unknown>;
  return {
    total: typeof g.total === 'number' ? g.total : null,
    adults: typeof g.adult_count === 'number' ? g.adult_count : null,
    children: typeof g.child_count === 'number' ? g.child_count : null,
    infants: typeof g.infant_count === 'number' ? g.infant_count : null,
    pets: typeof g.pet_count === 'number' ? g.pet_count : null,
  };
}

export type AssessGuestOptions = {
  organizationId: string;
  trigger: AssessmentTrigger;
  sourceMessageId?: string;
  userId?: string;
  forceRescore?: boolean;
};

export async function assessGuest(
  reservationId: string,
  options: AssessGuestOptions,
): Promise<Assessment | null> {
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);
  if (!reservation) return null;

  const orgId = options.organizationId;

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

  const hostRulesRows = await db
    .select({ ruleText: scoringRules.ruleText })
    .from(scoringRules)
    .where(and(eq(scoringRules.organizationId, orgId), eq(scoringRules.active, true)));

  const effectiveCatalog = await loadEffectiveCatalog(orgId, reservation.propertyId);

  let confirmedIncidents: ConfirmedIncident[] = [];
  if (reservation.guestFirstName && reservation.guestLastName) {
    const incidentRows = await db
      .select({
        incidentType: guestIncidents.incidentType,
        severity: guestIncidents.severity,
        notes: guestIncidents.notes,
        createdAt: guestIncidents.createdAt,
      })
      .from(guestIncidents)
      .where(
        and(
          eq(guestIncidents.organizationId, orgId),
          eq(guestIncidents.guestFirstName, reservation.guestFirstName),
          eq(guestIncidents.guestLastName, reservation.guestLastName),
          eq(guestIncidents.status, 'confirmed'),
        ),
      );
    confirmedIncidents = incidentRows.map((i) => ({
      type: i.incidentType,
      severity: i.severity as 'low' | 'medium' | 'high',
      notes: i.notes,
      date: i.createdAt.toISOString().slice(0, 10),
    }));
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

  const inputs: AssessmentPromptInputs = {
    booking: {
      guestName,
      guestCount: extractGuestCount(raw),
      nights: reservation.nights ?? null,
      arrivalDayOfWeek,
      bookingLeadDays,
    },
    thread,
    propertyHouseRules,
    hostScoringRules: hostRulesRows.map((r) => r.ruleText),
    effectiveCatalog,
    confirmedIncidents,
    pastReviews,
  };

  const inputsHash = computeInputsHash(inputs);
  const force =
    options.forceRescore ||
    options.trigger === 'manual_rescore' ||
    options.trigger === 'feedback';

  if (!force) {
    const [latest] = await db
      .select({
        inputsHash: guestAssessments.inputsHash,
        createdAt: guestAssessments.createdAt,
        score: guestAssessments.score,
        summary: guestAssessments.summary,
        riskLevel: guestAssessments.riskLevel,
        trustLevel: guestAssessments.trustLevel,
        recommendation: guestAssessments.recommendation,
        signals: guestAssessments.signals,
        rulesAcceptance: guestAssessments.rulesAcceptance,
      })
      .from(guestAssessments)
      .where(eq(guestAssessments.reservationId, reservationId))
      .orderBy(desc(guestAssessments.createdAt))
      .limit(1);

    if (latest) {
      if (latest.inputsHash === inputsHash) {
        return rowToAssessment(latest);
      }
      const ageMs = Date.now() - latest.createdAt.getTime();
      if (ageMs < DEBOUNCE_SECONDS * 1000) {
        return rowToAssessment(latest);
      }
    }
  }

  const prompt = buildAssessmentPrompt(inputs);
  const openai = new OpenAI();
  let assessment: Assessment | null = null;
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    });
    const content = response.choices[0]?.message?.content?.trim() ?? '';
    assessment = parseAssessmentResponse(content);
  } catch {
    return null;
  }
  if (!assessment) return null;

  await db
    .insert(guestAssessments)
    .values({
      id: uuidv4(),
      reservationId,
      organizationId: orgId,
      score: assessment.score,
      summary: assessment.summary,
      riskLevel: assessment.riskLevel,
      trustLevel: assessment.trustLevel,
      recommendation: assessment.recommendation,
      signals: assessment.signals,
      rulesAcceptance: assessment.rulesAcceptance,
      trigger: options.trigger,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      inputsHash,
      sourceMessageId: options.sourceMessageId ?? null,
      createdBy: options.userId ?? null,
    })
    .onConflictDoNothing({
      target: [guestAssessments.reservationId, guestAssessments.sourceMessageId],
    });

  await db
    .update(reservations)
    .set({
      guestScore: assessment.score,
      guestScoreSummary: assessment.summary,
      guestScoredAt: new Date(),
      guestRiskLevel: assessment.riskLevel,
      guestTrustLevel: assessment.trustLevel,
    })
    .where(eq(reservations.id, reservationId));

  return assessment;
}

function rowToAssessment(row: {
  score: number;
  summary: string;
  riskLevel: string;
  trustLevel: string;
  recommendation: string;
  signals: unknown;
  rulesAcceptance: unknown;
}): Assessment {
  return {
    score: row.score,
    summary: row.summary,
    riskLevel: row.riskLevel as 'low' | 'medium' | 'high',
    trustLevel: row.trustLevel as 'low' | 'medium' | 'high',
    recommendation: row.recommendation,
    signals: (row.signals as Array<{ catalogItemId: string; explanation: string }>) ?? [],
    rulesAcceptance: row.rulesAcceptance as Assessment['rulesAcceptance'],
  };
}
