# Guest Scoring Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the host give feedback on AI guest scores and rescore with a richer input set (full conversation, property house rules, org-wide scoring rules, past Hospitable reviews).

**Architecture:** A new `scoring_rules` DB table (org-scoped, editable from UI) plus a `house_rules` column on `properties`. Reviews get pulled from Hospitable into the existing `reviews` table via the sync handler. `scoreGuest()` is rewritten to assemble the prompt from all of these sources. A new `Give feedback` modal in the inbox writes either a global rule or a guest-specific note, then auto-rescores. A new `/settings/scoring-rules` page manages the rules list.

**Tech Stack:** Next.js 15 app routes, Drizzle ORM (Postgres), Zod, OpenAI SDK (`gpt-4o-mini`), `@walt/hospitable` client, shadcn UI.

**Spec:** `docs/superpowers/specs/2026-04-21-guest-scoring-feedback-loop-design.md`

---

## File Structure

### New files

- `packages/db/drizzle/0030_scoring_rules_and_house_rules.sql` — migration
- `apps/web/src/app/api/scoring-rules/handler.ts`
- `apps/web/src/app/api/scoring-rules/route.ts`
- `apps/web/src/app/api/scoring-rules/route.test.ts`
- `apps/web/src/app/api/scoring-rules/[id]/handler.ts`
- `apps/web/src/app/api/scoring-rules/[id]/route.ts`
- `apps/web/src/app/api/inbox/[reservationId]/feedback/handler.ts`
- `apps/web/src/app/api/inbox/[reservationId]/feedback/route.ts`
- `apps/web/src/app/api/inbox/[reservationId]/feedback/route.test.ts`
- `apps/web/src/app/settings/scoring-rules/page.tsx`
- `apps/web/src/app/settings/scoring-rules/ScoringRulesClient.tsx`
- `apps/web/src/app/inbox/FeedbackModal.tsx`
- `apps/web/src/lib/guest-scoring.test.ts`

### Modified files

- `packages/db/src/schema.ts` — add `scoringRules` table; add `houseRules` column to `properties`
- `packages/hospitable/src/resources/reviews.ts` — add `list(propertyUuid, query)` method
- `packages/hospitable/src/index.ts` — re-export `ReviewsResource` already re-exported; ensure no-op
- `apps/web/src/app/api/admin/sync-hospitable/handler.ts` — sync reviews + house rules
- `apps/web/src/lib/guest-scoring.ts` — rewrite input assembly
- `apps/web/src/app/inbox/ConversationThread.tsx` — add `Rescore` + `Give feedback` buttons
- `apps/web/src/lib/nav-links.ts` — add settings link to Scoring Rules page

---

## Task 1: DB schema — `scoring_rules` table and `properties.house_rules` column

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0030_scoring_rules_and_house_rules.sql`

- [ ] **Step 1: Add the `scoringRules` table + `houseRules` column to the schema**

In `packages/db/src/schema.ts`, add this near the `guests` table (keep related tables grouped):

```ts
export const scoringRules = waltSchema.table(
  'scoring_rules',
  {
    id: uuid('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    ruleText: text('rule_text').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
    createdBy: text('created_by'),
  },
  (table) => [
    index('scoring_rules_org_idx').on(table.organizationId),
  ],
);
```

In the `properties` table definition (`packages/db/src/schema.ts`, around line 67), add a new column at the end of the Hospitable extracted block:

```ts
  houseRules: text('house_rules'),
```

- [ ] **Step 2: Write the migration SQL**

Create `packages/db/drizzle/0030_scoring_rules_and_house_rules.sql`:

```sql
CREATE TABLE IF NOT EXISTS walt.scoring_rules (
  id uuid PRIMARY KEY,
  organization_id text NOT NULL,
  rule_text text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS scoring_rules_org_idx
  ON walt.scoring_rules (organization_id);

ALTER TABLE walt.properties
  ADD COLUMN IF NOT EXISTS house_rules text;
```

- [ ] **Step 3: Run migration locally and verify**

Run: `pnpm --filter @walt/db db:migrate`
Expected: `Migration 0030_scoring_rules_and_house_rules applied` (or equivalent success output).

Verify tables:
```
psql "$DATABASE_URL" -c "\d walt.scoring_rules"
psql "$DATABASE_URL" -c "\d walt.properties" | grep house_rules
```

- [ ] **Step 4: Typecheck the schema package**

Run: `pnpm turbo run typecheck --filter=@walt/db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0030_scoring_rules_and_house_rules.sql
git commit -m "feat(db): add scoring_rules table and properties.house_rules column"
```

---

## Task 2: Add `list()` method to `@walt/hospitable` reviews resource

The reviews resource today only has `respond()`. We need to list reviews per property to sync them.

**Files:**
- Modify: `packages/hospitable/src/resources/reviews.ts`
- Create: `packages/hospitable/src/resources/reviews.test.ts`

- [ ] **Step 1: Write a failing test for `list()`**

Create `packages/hospitable/src/resources/reviews.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { ReviewsResource } from './reviews.js';

describe('ReviewsResource.list', () => {
  it('calls GET /properties/{uuid}/reviews with query params', async () => {
    const request = vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1 } });
    const http = { request } as unknown as Parameters<typeof ReviewsResource>[0];
    const resource = new ReviewsResource(http);

    await resource.list('prop-uuid-1', { page: 1, per_page: 50 });

    expect(request).toHaveBeenCalledWith(
      '/properties/prop-uuid-1/reviews?page=1&per_page=50',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `pnpm --filter @walt/hospitable test reviews`
Expected: FAIL — `resource.list is not a function`.

- [ ] **Step 3: Implement `list()`**

Replace `packages/hospitable/src/resources/reviews.ts` contents with:

```ts
import type { HttpClient } from "../http.js";
import type {
  PostReviewsUuidRespond200,
  PostReviewsUuidRespondMutationRequest,
} from "../generated/types/index.js";
import {
  postReviewsUuidRespondMutationResponseSchema,
  getPropertyReviews200Schema,
} from "../generated/schemas/index.js";
import type { z } from 'zod';

export type ListReviewsQuery = {
  page?: number;
  per_page?: number;
  include?: string;
};

export type ListReviewsResponse = z.infer<typeof getPropertyReviews200Schema>;

export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /properties/{uuid}/reviews — list reviews for a property. */
  list(propertyUuid: string, query: ListReviewsQuery = {}) {
    const params = new URLSearchParams();
    if (query.page !== undefined) params.set('page', String(query.page));
    if (query.per_page !== undefined) params.set('per_page', String(query.per_page));
    if (query.include) params.set('include', query.include);
    const qs = params.toString();
    const path = `/properties/${propertyUuid}/reviews${qs ? `?${qs}` : ''}`;
    return this.http.request<ListReviewsResponse>(path, {
      method: 'GET',
      schema: getPropertyReviews200Schema,
    });
  }

  /** POST /reviews/{uuid}/respond — respond to a review. */
  respond(uuid: string, data: PostReviewsUuidRespondMutationRequest) {
    return this.http.request<PostReviewsUuidRespond200>(
      `/reviews/${uuid}/respond`,
      {
        method: "POST",
        body: data,
        schema: postReviewsUuidRespondMutationResponseSchema,
      }
    );
  }
}
```

- [ ] **Step 4: Run the test to verify pass**

Run: `pnpm --filter @walt/hospitable test reviews`
Expected: PASS.

- [ ] **Step 5: Typecheck the package**

Run: `pnpm turbo run typecheck --filter=@walt/hospitable`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/hospitable/src/resources/reviews.ts packages/hospitable/src/resources/reviews.test.ts
git commit -m "feat(hospitable): add reviews.list() method"
```

---

## Task 3: Extend Hospitable sync to pull reviews and house rules

**Files:**
- Modify: `apps/web/src/app/api/admin/sync-hospitable/handler.ts`

- [ ] **Step 1: Read the current sync handler**

Read `apps/web/src/app/api/admin/sync-hospitable/handler.ts` end-to-end. Identify:
- Where property rows are upserted (so we can extract `house_rules` from the raw Hospitable property and set the new column).
- Where per-property work loops run (so we can plug in reviews fetch).

- [ ] **Step 2: Extract house rules during property upsert**

Inside the property upsert block (where other Hospitable fields like `checkInTime`, `petsAllowed` are already mapped from `raw`), add:

```ts
// Hospitable exposes house rules as a string block on property.house_rules
// (may be nested under details or listings depending on include=). Prefer the
// first non-empty string we find.
function extractHouseRules(raw: Record<string, unknown>): string | null {
  const candidates = [
    raw.house_rules,
    (raw.details as Record<string, unknown> | undefined)?.house_rules,
    (raw.listings as Record<string, unknown> | undefined)?.house_rules,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return null;
}
```

Add `houseRules: extractHouseRules(propertyRaw),` to the `.set(...)` / `.values(...)` of the property upsert. If the existing code uses both insert and update paths, set it in both.

- [ ] **Step 3: Add a reviews sync block after properties sync**

After the property loop finishes (and properties are in DB), add:

```ts
import { reviews } from '@walt/db';
// ...

async function syncReviewsForProperty(
  hospitable: ReturnType<typeof createHospitableClient>,
  propertyId: string,
): Promise<number> {
  let page = 1;
  const perPage = 50;
  let total = 0;

  while (true) {
    const resp = await hospitable.reviews.list(propertyId, { page, per_page: perPage });
    const items = resp.data ?? [];
    if (items.length === 0) break;

    for (const r of items) {
      const rating = typeof r.rating === 'number' ? r.rating : null;
      await db
        .insert(reviews)
        .values({
          id: r.id ?? `${propertyId}-${r.reviewed_at ?? ''}-${rating ?? ''}`,
          reservationId: (r as Record<string, unknown>).reservation_id as string | null,
          propertyId,
          platform: (r as Record<string, unknown>).platform as string | null,
          rating,
          publicReview: (r as Record<string, unknown>).public_review as string | null,
          publicResponse: (r as Record<string, unknown>).public_response as string | null,
          privateFeedback: (r as Record<string, unknown>).private_feedback as string | null,
          guestFirstName: (r as Record<string, unknown>).guest_first_name as string | null,
          guestLastName: (r as Record<string, unknown>).guest_last_name as string | null,
          reviewedAt: r.reviewed_at ? new Date(r.reviewed_at) : null,
          respondedAt: (r as Record<string, unknown>).responded_at
            ? new Date((r as Record<string, unknown>).responded_at as string)
            : null,
          canRespond: (r as Record<string, unknown>).can_respond as boolean | null,
          raw: r as Record<string, unknown>,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: reviews.id,
          set: {
            rating,
            publicReview: (r as Record<string, unknown>).public_review as string | null,
            publicResponse: (r as Record<string, unknown>).public_response as string | null,
            privateFeedback: (r as Record<string, unknown>).private_feedback as string | null,
            raw: r as Record<string, unknown>,
            syncedAt: new Date(),
          },
        });
      total += 1;
    }

    const meta = resp.meta;
    if (!meta || !meta.last_page || page >= meta.last_page) break;
    page += 1;
  }

  return total;
}
```

Then, inside the sync function, after properties are upserted:

```ts
for (const property of syncedProperties) {
  try {
    await syncReviewsForProperty(hospitable, property.id);
  } catch (err) {
    // Review sync failure must not fail overall sync. Log and continue.
    console.error(`[sync-hospitable] Reviews sync failed for property ${property.id}`, err);
  }
}
```

- [ ] **Step 4: Typecheck the web app**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS.

- [ ] **Step 5: Run sync against a dev org manually**

Run from the web app directory:
```bash
curl -X POST http://localhost:3000/api/admin/sync-hospitable \
  -H 'Cookie: <dev session>'
```

Verify:
```
psql "$DATABASE_URL" -c "SELECT count(*) FROM walt.reviews;"
psql "$DATABASE_URL" -c "SELECT id, house_rules FROM walt.properties WHERE house_rules IS NOT NULL LIMIT 3;"
```
Expected: non-zero reviews count; at least one property with house_rules populated.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/admin/sync-hospitable/handler.ts
git commit -m "feat(sync): sync Hospitable reviews and property house rules"
```

---

## Task 4: Rewrite `scoreGuest()` with richer inputs

**Files:**
- Modify: `apps/web/src/lib/guest-scoring.ts`
- Create: `apps/web/src/lib/guest-scoring.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/guest-scoring.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildScoringPrompt } from './guest-scoring';

describe('buildScoringPrompt', () => {
  const base = {
    booking: {
      guestName: 'Michael Smith',
      guestCount: { total: 4, adults: 2, children: 2, infants: 0, pets: 1 },
      nights: 7,
      arrivalDayOfWeek: 'Friday',
      bookingLeadDays: 3,
    },
    thread: [
      { sender: 'guest' as const, body: 'We want to book April 24–May 1.' },
      { sender: 'host' as const, body: 'Please confirm you accept house rules.' },
      { sender: 'guest' as const, body: 'Would you consider a pet deposit?' },
    ],
    propertyHouseRules: 'No pets. No parties. No unregistered visitors.',
    scoringRules: ['Exception-seeking on pet/visitor rules is a red flag.'],
    internalHistory: null,
    pastReviews: [],
  };

  it('includes every non-empty section', () => {
    const prompt = buildScoringPrompt(base);
    expect(prompt).toContain('PROPERTY HOUSE RULES');
    expect(prompt).toContain('No pets. No parties.');
    expect(prompt).toContain('HOST RULES');
    expect(prompt).toContain('Exception-seeking');
    expect(prompt).toContain('CONVERSATION SO FAR');
    expect(prompt).toContain('pet deposit');
    expect(prompt).toContain('BOOKING');
  });

  it('omits HOST RULES block when list is empty', () => {
    const prompt = buildScoringPrompt({ ...base, scoringRules: [] });
    expect(prompt).not.toContain('HOST RULES');
  });

  it('omits PROPERTY HOUSE RULES when null', () => {
    const prompt = buildScoringPrompt({ ...base, propertyHouseRules: null });
    expect(prompt).not.toContain('PROPERTY HOUSE RULES');
  });

  it('omits GUEST HISTORY when no internal history and no reviews', () => {
    const prompt = buildScoringPrompt({ ...base, internalHistory: null, pastReviews: [] });
    expect(prompt).not.toContain('GUEST HISTORY');
  });

  it('keeps most recent 20 messages regardless of budget', () => {
    const thread = Array.from({ length: 30 }, (_, i) => ({
      sender: (i % 2 === 0 ? 'guest' : 'host') as 'guest' | 'host',
      body: `msg-${i}`,
    }));
    const prompt = buildScoringPrompt({ ...base, thread });
    // The 20 most recent (msg-10..msg-29) must all appear.
    for (let i = 10; i < 30; i += 1) {
      expect(prompt).toContain(`msg-${i}`);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @walt/web test guest-scoring`
Expected: FAIL — `buildScoringPrompt is not defined`.

- [ ] **Step 3: Rewrite `guest-scoring.ts`**

Replace `apps/web/src/lib/guest-scoring.ts` with:

```ts
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
    guestCount: { total: number | null; adults: number | null; children: number | null; infants: number | null; pets: number | null };
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
    const formatted = trimmed
      .map((m) => `[${m.sender}] ${m.body}`)
      .join('\n');
    sections.push(`CONVERSATION SO FAR:\n${formatted}`);
  }

  const historyParts: string[] = [];
  if (inputs.internalHistory) historyParts.push(`- Internal notes: ${inputs.internalHistory}`);
  if (inputs.pastReviews.length > 0) {
    const reviewLines = inputs.pastReviews.slice(0, MAX_REVIEWS).map((r) => {
      const star = r.rating != null ? `★${r.rating}` : '★?';
      const text = (r.publicReview ?? r.privateFeedback ?? '').slice(0, REVIEW_SNIPPET_MAX);
      return `  * ${star} — "${text}"`;
    });
    historyParts.push(`- Past reviews:\n${reviewLines.join('\n')}`);
  }
  if (historyParts.length > 0) {
    sections.push(`GUEST HISTORY:\n${historyParts.join('\n')}`);
  }

  return sections.join('\n\n');
}

function trimThread(thread: ThreadMessage[]): ThreadMessage[] {
  // Always keep the most recent MIN_RECENT_MESSAGES.
  // Beyond that, trim oldest first until under CHAR_BUDGET.
  if (thread.length <= MIN_RECENT_MESSAGES) return thread;

  const recent = thread.slice(-MIN_RECENT_MESSAGES);
  const older = thread.slice(0, -MIN_RECENT_MESSAGES);
  let budget = CHAR_BUDGET - totalChars(recent);
  const keptOlder: ThreadMessage[] = [];
  for (let i = older.length - 1; i >= 0; i -= 1) {
    const m = older[i]!;
    const cost = m.body.length + 16; // rough overhead per message
    if (cost > budget) break;
    budget -= cost;
    keptOlder.unshift(m);
  }
  return [...keptOlder, ...recent];
}

function totalChars(msgs: ThreadMessage[]): number {
  return msgs.reduce((sum, m) => sum + m.body.length + 16, 0);
}

function extractGuestCount(raw: Record<string, unknown>) {
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

  // Full thread (chronological).
  const threadRows = await db
    .select({ senderType: messages.senderType, body: messages.body })
    .from(messages)
    .where(eq(messages.reservationId, reservationId))
    .orderBy(asc(messages.createdAt));
  const thread: ThreadMessage[] = threadRows
    .filter((m) => m.body && (m.senderType === 'guest' || m.senderType === 'host'))
    .map((m) => ({ sender: m.senderType as 'guest' | 'host', body: m.body as string }));

  // Property house rules.
  let propertyHouseRules: string | null = null;
  if (reservation.propertyId) {
    const [prop] = await db
      .select({ houseRules: properties.houseRules })
      .from(properties)
      .where(eq(properties.id, reservation.propertyId))
      .limit(1);
    propertyHouseRules = prop?.houseRules ?? null;
  }

  // Internal guest history.
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

  // Past reviews (by guest name match).
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

  // Host scoring rules (org-wide, active only).
  // NOTE: reservations currently have no organizationId column; derive from the property
  // if available, otherwise fall back to ALL active rules. Acceptable while single-tenant.
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
```

- [ ] **Step 4: Run the tests to verify pass**

Run: `pnpm --filter @walt/web test guest-scoring`
Expected: all 5 tests PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/guest-scoring.ts apps/web/src/lib/guest-scoring.test.ts
git commit -m "feat(scoring): rewrite scoreGuest with full thread, rules, house rules, reviews"
```

---

## Task 5: `/api/scoring-rules` CRUD routes

**Files:**
- Create: `apps/web/src/app/api/scoring-rules/handler.ts`
- Create: `apps/web/src/app/api/scoring-rules/route.ts`
- Create: `apps/web/src/app/api/scoring-rules/route.test.ts`
- Create: `apps/web/src/app/api/scoring-rules/[id]/handler.ts`
- Create: `apps/web/src/app/api/scoring-rules/[id]/route.ts`

- [ ] **Step 1: Write the failing route test**

Create `apps/web/src/app/api/scoring-rules/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleListScoringRules, handleCreateScoringRule } from './handler';

describe('scoring-rules routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handleListScoringRules returns org rules sorted newest first', async () => {
    const listRules = vi.fn().mockResolvedValue([
      { id: '1', ruleText: 'Rule one', active: true, createdAt: new Date('2026-01-02') },
      { id: '2', ruleText: 'Rule two', active: false, createdAt: new Date('2026-01-01') },
    ]);
    const res = await handleListScoringRules({ orgId: 'org-1' }, { listRules });
    expect(listRules).toHaveBeenCalledWith('org-1');
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].id).toBe('1');
  });

  it('handleCreateScoringRule rejects empty rule text', async () => {
    const createRule = vi.fn();
    const req = new Request('http://test/api/scoring-rules', {
      method: 'POST',
      body: JSON.stringify({ ruleText: '   ' }),
    });
    const res = await handleCreateScoringRule(req, { orgId: 'org-1', userId: 'u-1' }, { createRule });
    expect(res.status).toBe(400);
    expect(createRule).not.toHaveBeenCalled();
  });

  it('handleCreateScoringRule inserts and returns the new rule', async () => {
    const createRule = vi.fn().mockResolvedValue({
      id: 'new-id',
      ruleText: 'No parties.',
      active: true,
      createdAt: new Date(),
    });
    const req = new Request('http://test/api/scoring-rules', {
      method: 'POST',
      body: JSON.stringify({ ruleText: 'No parties.' }),
    });
    const res = await handleCreateScoringRule(req, { orgId: 'org-1', userId: 'u-1' }, { createRule });
    expect(res.status).toBe(201);
    expect(createRule).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'u-1', ruleText: 'No parties.' });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @walt/web test scoring-rules`
Expected: FAIL — handler not found.

- [ ] **Step 3: Write `handler.ts` (list + create)**

Create `apps/web/src/app/api/scoring-rules/handler.ts`:

```ts
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/lib/db';
import { scoringRules } from '@walt/db';
import { handleApiError } from '@/lib/secure-logger';

const createBodySchema = z.object({
  ruleText: z.string().trim().min(1, 'Rule text required').max(500),
});

type ScoringRuleRow = typeof scoringRules.$inferSelect;

type Deps = {
  listRules?: (orgId: string) => Promise<ScoringRuleRow[]>;
  createRule?: (args: { orgId: string; userId: string; ruleText: string }) => Promise<ScoringRuleRow>;
};

async function defaultListRules(orgId: string): Promise<ScoringRuleRow[]> {
  return db
    .select()
    .from(scoringRules)
    .where(eq(scoringRules.organizationId, orgId))
    .orderBy(desc(scoringRules.createdAt));
}

async function defaultCreateRule(args: {
  orgId: string;
  userId: string;
  ruleText: string;
}): Promise<ScoringRuleRow> {
  const [row] = await db
    .insert(scoringRules)
    .values({
      id: uuidv4(),
      organizationId: args.orgId,
      ruleText: args.ruleText,
      active: true,
      createdBy: args.userId,
    })
    .returning();
  if (!row) throw new Error('Failed to create scoring rule');
  return row;
}

export async function handleListScoringRules(
  auth: { orgId: string },
  deps: Deps = {},
) {
  try {
    const listRules = deps.listRules ?? defaultListRules;
    const items = await listRules(auth.orgId);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError({ error, route: '/api/scoring-rules GET' });
  }
}

export async function handleCreateScoringRule(
  request: Request,
  auth: { orgId: string; userId: string },
  deps: Deps = {},
) {
  try {
    const body = await request.json();
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const createRule = deps.createRule ?? defaultCreateRule;
    const item = await createRule({
      orgId: auth.orgId,
      userId: auth.userId,
      ruleText: parsed.data.ruleText,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError({ error, route: '/api/scoring-rules POST' });
  }
}
```

- [ ] **Step 4: Write `route.ts`**

Create `apps/web/src/app/api/scoring-rules/route.ts`:

```ts
import { withPermission } from '@/lib/auth/authorize';
import { handleListScoringRules, handleCreateScoringRule } from './handler';

export const GET = withPermission('properties.read', async (_req, _ctx, auth) =>
  handleListScoringRules({ orgId: auth.orgId }),
);

export const POST = withPermission('properties.update', async (req, _ctx, auth) =>
  handleCreateScoringRule(req, { orgId: auth.orgId, userId: auth.userId }),
);
```

If `auth.userId` is not a field on the `auth` object provided by `withPermission`, inspect `apps/web/src/lib/auth/authorize.ts` and use the correct field (likely `auth.session.userId` or similar). Adapt the call accordingly.

- [ ] **Step 5: Write `[id]` handler and route (PATCH + DELETE)**

Create `apps/web/src/app/api/scoring-rules/[id]/handler.ts`:

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { scoringRules } from '@walt/db';
import { handleApiError } from '@/lib/secure-logger';

const patchBodySchema = z.object({
  ruleText: z.string().trim().min(1).max(500).optional(),
  active: z.boolean().optional(),
});

export async function handlePatchScoringRule(
  request: Request,
  params: { id: string },
  auth: { orgId: string },
) {
  try {
    const parsed = patchBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const [row] = await db
      .update(scoringRules)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(scoringRules.id, params.id), eq(scoringRules.organizationId, auth.orgId)))
      .returning();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item: row });
  } catch (error) {
    return handleApiError({ error, route: '/api/scoring-rules/[id] PATCH' });
  }
}

export async function handleDeleteScoringRule(
  params: { id: string },
  auth: { orgId: string },
) {
  try {
    const [row] = await db
      .delete(scoringRules)
      .where(and(eq(scoringRules.id, params.id), eq(scoringRules.organizationId, auth.orgId)))
      .returning({ id: scoringRules.id });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError({ error, route: '/api/scoring-rules/[id] DELETE' });
  }
}
```

Create `apps/web/src/app/api/scoring-rules/[id]/route.ts`:

```ts
import { withPermission } from '@/lib/auth/authorize';
import { handlePatchScoringRule, handleDeleteScoringRule } from './handler';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withPermission('properties.update', async (req, ctx: Ctx, auth) => {
  const params = await ctx.params;
  return handlePatchScoringRule(req, params, { orgId: auth.orgId });
});

export const DELETE = withPermission('properties.update', async (_req, ctx: Ctx, auth) => {
  const params = await ctx.params;
  return handleDeleteScoringRule(params, { orgId: auth.orgId });
});
```

- [ ] **Step 6: Run tests and typecheck**

Run:
```
pnpm --filter @walt/web test scoring-rules
pnpm turbo run typecheck lint --filter=@walt/web
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/scoring-rules
git commit -m "feat(api): CRUD routes for scoring rules"
```

---

## Task 6: `/api/inbox/[reservationId]/feedback` route

**Files:**
- Create: `apps/web/src/app/api/inbox/[reservationId]/feedback/handler.ts`
- Create: `apps/web/src/app/api/inbox/[reservationId]/feedback/route.ts`
- Create: `apps/web/src/app/api/inbox/[reservationId]/feedback/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/inbox/[reservationId]/feedback/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleFeedback } from './handler';

describe('inbox feedback handler', () => {
  it('target=rule inserts a new scoring rule', async () => {
    const createRule = vi.fn().mockResolvedValue({ id: 'r-1' });
    const appendGuestNote = vi.fn();
    const rescore = vi.fn().mockResolvedValue({ score: 4, summary: 'Boundary-pushing pattern.' });
    const req = new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({ text: 'Pet exception-seeking = red flag', target: 'rule' }),
    });
    const res = await handleFeedback(req, 'res-1', { orgId: 'o-1', userId: 'u-1' }, {
      createRule, appendGuestNote, rescore,
    });
    expect(createRule).toHaveBeenCalledWith({ orgId: 'o-1', userId: 'u-1', ruleText: 'Pet exception-seeking = red flag' });
    expect(appendGuestNote).not.toHaveBeenCalled();
    expect(rescore).toHaveBeenCalledWith('res-1');
    const body = await res.json();
    expect(body.score).toBe(4);
  });

  it('target=guest appends to guest notes, creating row if missing', async () => {
    const createRule = vi.fn();
    const appendGuestNote = vi.fn().mockResolvedValue({ ok: true });
    const rescore = vi.fn().mockResolvedValue({ score: 5, summary: 's' });
    const req = new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({ text: 'Tried to bring a dog.', target: 'guest' }),
    });
    await handleFeedback(req, 'res-1', { orgId: 'o-1', userId: 'u-1' }, {
      createRule, appendGuestNote, rescore,
    });
    expect(appendGuestNote).toHaveBeenCalledWith({
      orgId: 'o-1',
      reservationId: 'res-1',
      note: 'Tried to bring a dog.',
    });
    expect(createRule).not.toHaveBeenCalled();
  });

  it('rejects empty text', async () => {
    const req = new Request('http://test', {
      method: 'POST',
      body: JSON.stringify({ text: '   ', target: 'rule' }),
    });
    const res = await handleFeedback(req, 'res-1', { orgId: 'o-1', userId: 'u-1' }, {
      createRule: vi.fn(), appendGuestNote: vi.fn(), rescore: vi.fn(),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @walt/web test inbox/.*feedback`
Expected: FAIL.

- [ ] **Step 3: Implement handler**

Create `apps/web/src/app/api/inbox/[reservationId]/feedback/handler.ts`:

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/lib/db';
import { scoringRules, guests, reservations } from '@walt/db';
import { scoreGuest } from '@/lib/guest-scoring';
import { handleApiError } from '@/lib/secure-logger';

const bodySchema = z.object({
  text: z.string().trim().min(1).max(1000),
  target: z.enum(['rule', 'guest']),
});

type Deps = {
  createRule?: (args: { orgId: string; userId: string; ruleText: string }) => Promise<{ id: string }>;
  appendGuestNote?: (args: { orgId: string; reservationId: string; note: string }) => Promise<{ ok: true }>;
  rescore?: (reservationId: string) => Promise<{ score: number; summary: string } | null>;
};

async function defaultCreateRule(args: { orgId: string; userId: string; ruleText: string }) {
  const [row] = await db
    .insert(scoringRules)
    .values({
      id: uuidv4(),
      organizationId: args.orgId,
      ruleText: args.ruleText,
      active: true,
      createdBy: args.userId,
    })
    .returning({ id: scoringRules.id });
  if (!row) throw new Error('Failed to create scoring rule');
  return row;
}

async function defaultAppendGuestNote(args: {
  orgId: string;
  reservationId: string;
  note: string;
}) {
  const [reservation] = await db
    .select({ firstName: reservations.guestFirstName, lastName: reservations.guestLastName })
    .from(reservations)
    .where(eq(reservations.id, args.reservationId))
    .limit(1);
  if (!reservation || !reservation.firstName || !reservation.lastName) {
    throw new Error('Reservation or guest name not found');
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const line = `[${timestamp}] ${args.note}`;

  const [existing] = await db
    .select({ id: guests.id, notes: guests.notes })
    .from(guests)
    .where(
      and(
        eq(guests.organizationId, args.orgId),
        eq(guests.firstName, reservation.firstName),
        eq(guests.lastName, reservation.lastName),
      ),
    )
    .limit(1);

  if (existing) {
    const combined = existing.notes ? `${existing.notes}\n${line}` : line;
    await db.update(guests).set({ notes: combined, updatedAt: new Date() }).where(eq(guests.id, existing.id));
  } else {
    await db.insert(guests).values({
      id: uuidv4(),
      organizationId: args.orgId,
      firstName: reservation.firstName,
      lastName: reservation.lastName,
      notes: line,
    });
  }

  return { ok: true as const };
}

async function persistRescore(reservationId: string) {
  const result = await scoreGuest(reservationId);
  if (!result) return null;
  await db
    .update(reservations)
    .set({
      guestScore: result.score,
      guestScoreSummary: result.summary,
      guestScoredAt: new Date(),
    })
    .where(eq(reservations.id, reservationId));
  return result;
}

export async function handleFeedback(
  request: Request,
  reservationId: string,
  auth: { orgId: string; userId: string },
  deps: Deps = {},
) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { text, target } = parsed.data;

    const createRule = deps.createRule ?? defaultCreateRule;
    const appendGuestNote = deps.appendGuestNote ?? defaultAppendGuestNote;
    const rescore = deps.rescore ?? persistRescore;

    if (target === 'rule') {
      await createRule({ orgId: auth.orgId, userId: auth.userId, ruleText: text });
    } else {
      await appendGuestNote({ orgId: auth.orgId, reservationId, note: text });
    }

    const result = await rescore(reservationId);
    if (!result) {
      return NextResponse.json({ error: 'Rescore failed' }, { status: 503 });
    }
    return NextResponse.json({ score: result.score, summary: result.summary });
  } catch (error) {
    return handleApiError({ error, route: '/api/inbox/[id]/feedback' });
  }
}
```

- [ ] **Step 4: Write the route file**

Create `apps/web/src/app/api/inbox/[reservationId]/feedback/route.ts`:

```ts
import { withPermission } from '@/lib/auth/authorize';
import { handleFeedback } from './handler';

type Ctx = { params: Promise<{ reservationId: string }> };

export const POST = withPermission('properties.update', async (req, ctx: Ctx, auth) => {
  const { reservationId } = await ctx.params;
  return handleFeedback(req, reservationId, { orgId: auth.orgId, userId: auth.userId });
});
```

- [ ] **Step 5: Run tests and typecheck**

Run:
```
pnpm --filter @walt/web test feedback
pnpm turbo run typecheck --filter=@walt/web
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/inbox/\[reservationId\]/feedback
git commit -m "feat(api): inbox feedback endpoint writes rule or guest note and rescores"
```

---

## Task 7: Inbox UI — Rescore button + Feedback modal

**Files:**
- Create: `apps/web/src/app/inbox/FeedbackModal.tsx`
- Modify: `apps/web/src/app/inbox/ConversationThread.tsx` (score display area)

- [ ] **Step 1: Read the current score display in the thread**

Read `apps/web/src/app/inbox/ConversationThread.tsx`. Find the block that renders `guestScore` / `guestScoreSummary`. Identify the JSX node and surrounding props (e.g. `reservationId`, `onRescored` callback, etc.).

- [ ] **Step 2: Build `FeedbackModal.tsx`**

Create `apps/web/src/app/inbox/FeedbackModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type Props = {
  reservationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescored: (score: number, summary: string) => void;
};

export function FeedbackModal({ reservationId, open, onOpenChange, onRescored }: Props) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState<'rule' | 'guest'>('rule');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/${reservationId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), target }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === 'string' ? body.error : 'Failed to save feedback');
        return;
      }
      const body = (await res.json()) as { score: number; summary: string };
      onRescored(body.score, body.summary);
      setText('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give feedback on this score</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>What did the AI miss?</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Guest is pushing for a pet deposit after we said no pets."
              rows={4}
            />
          </div>

          <RadioGroup value={target} onValueChange={(v) => setTarget(v as 'rule' | 'guest')}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="rule" id="fb-rule" />
              <Label htmlFor="fb-rule">Save as house rule (applies to all future guests)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="guest" id="fb-guest" />
              <Label htmlFor="fb-guest">Save as note on this guest only</Label>
            </div>
          </RadioGroup>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || text.trim().length === 0}>
            {submitting ? 'Saving…' : 'Save & rescore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

If `@/components/ui/radio-group` or `@/components/ui/textarea` isn't already installed, add them:
```bash
cd apps/web && npx shadcn@latest add radio-group textarea
```

- [ ] **Step 3: Wire the modal + Rescore button into `ConversationThread.tsx`**

Near the score display in `ConversationThread.tsx`:

```tsx
import { FeedbackModal } from './FeedbackModal';
import { useState } from 'react';
// ...

const [feedbackOpen, setFeedbackOpen] = useState(false);
const [rescoring, setRescoring] = useState(false);
const [localScore, setLocalScore] = useState<{ score: number; summary: string } | null>(null);

async function handleRescore() {
  setRescoring(true);
  try {
    const res = await fetch(`/api/inbox/${reservationId}/score`, { method: 'POST' });
    if (res.ok) {
      const body = (await res.json()) as { score: number; summary: string };
      setLocalScore({ score: body.score, summary: body.summary });
    }
  } finally {
    setRescoring(false);
  }
}
```

In the JSX near the score badge:

```tsx
<div className="flex items-center gap-2">
  <Button size="sm" variant="outline" onClick={handleRescore} disabled={rescoring}>
    {rescoring ? 'Rescoring…' : 'Rescore'}
  </Button>
  <Button size="sm" variant="outline" onClick={() => setFeedbackOpen(true)}>
    Give feedback
  </Button>
</div>

<FeedbackModal
  reservationId={reservationId}
  open={feedbackOpen}
  onOpenChange={setFeedbackOpen}
  onRescored={(score, summary) => setLocalScore({ score, summary })}
/>
```

If `localScore` is set, render it in place of the DB-loaded score so the UI updates immediately without a refetch.

- [ ] **Step 4: Manual smoke test**

Start the dev server:
```bash
pnpm --filter @walt/web dev
```
Open a conversation with a scored guest. Verify:
- The Rescore button runs and updates the score badge + summary without reload.
- The Give feedback button opens the modal.
- Submitting as "house rule" closes modal and updates the score.
- Submitting as "guest note" closes modal and updates the score.
- Empty text disables the Save button.

- [ ] **Step 5: Typecheck + lint + build**

Run: `pnpm turbo run typecheck lint build --filter=@walt/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/inbox/FeedbackModal.tsx apps/web/src/app/inbox/ConversationThread.tsx apps/web/package.json apps/web/src/components/ui/
git commit -m "feat(inbox): rescore + give feedback buttons with modal"
```

---

## Task 8: `/settings/scoring-rules` page

**Files:**
- Create: `apps/web/src/app/settings/scoring-rules/page.tsx`
- Create: `apps/web/src/app/settings/scoring-rules/ScoringRulesClient.tsx`
- Modify: `apps/web/src/lib/nav-links.ts`

- [ ] **Step 1: Build the server page**

Create `apps/web/src/app/settings/scoring-rules/page.tsx`:

```tsx
import { ScoringRulesClient } from './ScoringRulesClient';

export default function ScoringRulesPage() {
  return (
    <div className="max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Scoring Rules</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Rules and red-flag patterns used by the AI when scoring incoming guests. Add one per line.
      </p>
      <ScoringRulesClient />
    </div>
  );
}
```

- [ ] **Step 2: Build the client component**

Create `apps/web/src/app/settings/scoring-rules/ScoringRulesClient.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

type Rule = {
  id: string;
  ruleText: string;
  active: boolean;
  createdAt: string;
};

export function ScoringRulesClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/scoring-rules');
    if (res.ok) {
      const body = (await res.json()) as { items: Rule[] };
      setRules(body.items);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addRule() {
    if (!newText.trim()) return;
    setSaving(true);
    const res = await fetch('/api/scoring-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleText: newText.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setNewText('');
      await load();
    }
  }

  async function toggleActive(rule: Rule) {
    await fetch(`/api/scoring-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    });
    await load();
  }

  async function remove(rule: Rule) {
    await fetch(`/api/scoring-rules/${rule.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={3}
            placeholder="e.g. Guests asking for pet exceptions after the no-pets rule = red flag."
          />
          <div className="flex justify-end">
            <Button onClick={addRule} disabled={saving || newText.trim().length === 0}>
              {saving ? 'Adding…' : 'Add rule'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet.</p>
          ) : (
            <ul className="divide-y">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-start gap-3 py-3">
                  <Switch checked={rule.active} onCheckedChange={() => toggleActive(rule)} />
                  <div className="flex-1">
                    <p className={rule.active ? '' : 'text-muted-foreground line-through'}>
                      {rule.ruleText}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(rule.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(rule)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

If `@/components/ui/switch` isn't present, add it:
```bash
cd apps/web && npx shadcn@latest add switch
```

- [ ] **Step 3: Add nav link**

In `apps/web/src/lib/nav-links.ts`, find the Settings nav group and add an entry:

```ts
{ href: '/settings/scoring-rules', label: 'Scoring Rules', icon: 'ShieldAlert' }
```

Use the existing icon name convention in that file; if icons are imported from `lucide-react` by name, `ShieldAlert` is appropriate.

- [ ] **Step 4: Manual smoke test**

Navigate to `/settings/scoring-rules`. Verify:
- Empty state shows.
- Adding a rule inserts it at the top of the list.
- Toggling active works (strikethrough + disabled when off).
- Deleting removes it.
- Rules immediately affect the next score (verify by rescoring a reservation in the inbox).

- [ ] **Step 5: Typecheck + lint + build**

Run: `pnpm turbo run typecheck lint build --filter=@walt/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/settings/scoring-rules apps/web/src/lib/nav-links.ts apps/web/package.json apps/web/src/components/ui/
git commit -m "feat(settings): scoring rules management page"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full monorepo check**

Run: `pnpm turbo run typecheck lint build --filter=@walt/web`
Expected: all PASS.

- [ ] **Step 2: Full test suite**

Run: `pnpm --filter @walt/web test`
Expected: all PASS.

- [ ] **Step 3: End-to-end smoke**

1. Sync Hospitable (`POST /api/admin/sync-hospitable`). Confirm reviews rows and house_rules populated.
2. Open an inbox conversation with a scored reservation.
3. Click **Rescore** — score updates using new inputs.
4. Click **Give feedback**, target "house rule", submit — verify rule appears in `/settings/scoring-rules` and score changes.
5. Click **Give feedback**, target "guest note", submit — verify `guests.notes` appended.
6. Delete a rule from settings. Rescore — verify the model is no longer influenced by that rule.

- [ ] **Step 4: Open PR**

Branch name: `feat/guest-scoring-feedback-loop` (fresh from `origin/main`).
PR title: `feat: AI guest scoring feedback loop`
PR body references the spec at `docs/superpowers/specs/2026-04-21-guest-scoring-feedback-loop-design.md`.
