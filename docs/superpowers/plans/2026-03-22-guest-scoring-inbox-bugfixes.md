# Guest Scoring & Inbox/Calendar Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three inbox/calendar bugs (cancelled bookings on calendar, missing status badges, cancellation priority) and add AI-powered guest scoring with a 1-10 risk score + advisory summary.

**Architecture:** Bug fixes are isolated changes to the normalizer, calendar API, status config, and inbox API. Guest scoring adds three columns to the reservations table, a new `guest-scoring.ts` library, a re-score API endpoint, and UI updates to the inbox list and thread views.

**Tech Stack:** Next.js, Drizzle ORM (PostgreSQL), OpenAI SDK, Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-22-guest-scoring-inbox-bugfixes-design.md`

---

### Task 1: Fix status normalization — read from `reservation_status.current.category`

**Files:**
- Modify: `apps/web/src/lib/hospitable-normalize.ts:51`
- Modify: `apps/web/src/lib/hospitable-normalize.test.ts`

- [ ] **Step 1: Update test fixture to include `reservation_status` and verify current behavior**

Add a new test that verifies the normalizer reads from `reservation_status.current.category`:

```typescript
void test('normalizeReservation reads status from reservation_status.current.category', () => {
  const raw = {
    id: 'res-status-1',
    status: 'booking', // deprecated field
    reservation_status: {
      current: { category: 'accepted', sub_category: 'accepted' },
      history: [],
    },
  };
  const result = normalizeReservation(raw);
  assert.equal(result.status, 'accepted');
});

void test('normalizeReservation falls back to raw.status when reservation_status is absent', () => {
  const raw = { id: 'res-fallback', status: 'cancelled' };
  const result = normalizeReservation(raw);
  assert.equal(result.status, 'cancelled');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx tsx --test src/lib/hospitable-normalize.test.ts`
Expected: First test FAILS (returns `'booking'` instead of `'accepted'`)

- [ ] **Step 3: Update normalizer to read `reservation_status.current.category`**

In `apps/web/src/lib/hospitable-normalize.ts`, change line 51 from:

```typescript
status: str(raw.status),
```

to:

```typescript
status: (() => {
  const rs = raw.reservation_status as Record<string, unknown> | undefined;
  const current = rs?.current as Record<string, unknown> | undefined;
  const category = current?.category;
  return str(category) ?? str(raw.status);
})(),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx tsx --test src/lib/hospitable-normalize.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hospitable-normalize.ts apps/web/src/lib/hospitable-normalize.test.ts
git commit -m "fix: read reservation status from reservation_status.current.category instead of deprecated status field"
```

---

### Task 2: Update status config and sync handler for new status values

**Files:**
- Modify: `apps/web/src/app/inbox/status-config.ts`
- Modify: `apps/web/src/app/api/admin/sync-hospitable/handler.ts:12-19`

- [ ] **Step 1: Update `STATUS_BADGE_CONFIG` with Hospitable category values**

In `apps/web/src/app/inbox/status-config.ts`, replace the entire file with:

```typescript
import type React from 'react';
import { HelpCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

export const STATUS_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  inquiry: { label: 'Inquiry', className: 'bg-sky-100 text-sky-700 border-0' },
  request: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-0' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-0' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700 border-0' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700 border-0' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-0' },
};

export const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  inquiry: HelpCircle,
  request: Clock,
  pending: Clock,
  accepted: CheckCircle,
  confirmed: CheckCircle,
  cancelled: XCircle,
};

export const STATUS_COLORS: Record<string, string> = {
  inquiry: 'text-sky-600',
  request: 'text-amber-500',
  pending: 'text-amber-500',
  accepted: 'text-green-600',
  confirmed: 'text-green-600',
  cancelled: 'text-red-600',
};
```

- [ ] **Step 2: Update `CORE_STATUSES` and `STATUS_MESSAGES` in sync handler**

In `apps/web/src/app/api/admin/sync-hospitable/handler.ts`, replace lines 12-19 with:

```typescript
const CORE_STATUSES = ['inquiry', 'request', 'accepted', 'cancelled'] as const;

const STATUS_MESSAGES: Record<string, string> = {
  inquiry: 'Guest sent an inquiry',
  request: 'New booking request received',
  accepted: 'Reservation confirmed',
  cancelled: 'Reservation cancelled',
};
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/inbox/status-config.ts apps/web/src/app/api/admin/sync-hospitable/handler.ts
git commit -m "fix: update status config and sync handler to match Hospitable reservation_status categories"
```

---

### Task 3: Filter cancelled bookings from calendar

**Files:**
- Modify: `apps/web/src/app/api/calendar/route.ts:44-50`

- [ ] **Step 1: Add status filter to calendar query**

In `apps/web/src/app/api/calendar/route.ts`, add `ne` to the imports on line 1:

```typescript
import { and, asc, eq, gte, lte, ne } from 'drizzle-orm';
```

Then update the reservations query `where` clause (lines 45-50) to add the cancelled filter:

```typescript
    .where(
      and(
        lte(reservations.arrivalDate, new Date(end)),
        gte(reservations.departureDate, new Date(start)),
        ne(reservations.status, 'cancelled'),
      ),
    )
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/calendar/route.ts
git commit -m "fix: filter cancelled bookings from calendar view"
```

---

### Task 4: Prioritize recently cancelled reservations in inbox sorting

**Files:**
- Modify: `apps/web/src/app/api/inbox/route.ts:100-125`

- [ ] **Step 1: Add cancellation priority sorting logic**

In `apps/web/src/app/api/inbox/route.ts`, after the thread list is built (after line 125, before the filter block), add sorting logic that boosts recently cancelled threads to the top:

```typescript
    // Sort: recently cancelled (within 24h) first, then by lastMessageAt
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    threads.sort((a, b) => {
      const aRecentlyCancelled =
        a.status === 'cancelled' && new Date(a.lastMessageAt) > twentyFourHoursAgo;
      const bRecentlyCancelled =
        b.status === 'cancelled' && new Date(b.lastMessageAt) > twentyFourHoursAgo;
      if (aRecentlyCancelled && !bRecentlyCancelled) return -1;
      if (!aRecentlyCancelled && bRecentlyCancelled) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/inbox/route.ts
git commit -m "fix: prioritize recently cancelled reservations at top of inbox"
```

---

### Task 5: Add guest scoring columns to schema and generate migration

**Files:**
- Modify: `packages/db/src/schema.ts:77-101`
- Create: `packages/db/drizzle/` (new migration generated by drizzle-kit)

- [ ] **Step 1: Add three columns to the reservations table**

In `packages/db/src/schema.ts`, add these three columns after `currency` (before `raw`) inside the reservations table definition:

```typescript
  guestScore: integer('guest_score'),
  guestScoreSummary: text('guest_score_summary'),
  guestScoredAt: timestamp('guest_scored_at', { withTimezone: true }),
```

- [ ] **Step 2: Run typecheck to ensure schema compiles**

Run: `pnpm turbo run typecheck --filter=@walt/db`
Expected: PASS

- [ ] **Step 3: Generate Drizzle migration**

Run: `cd packages/db && pnpm drizzle-kit generate`
Expected: Migration SQL file created in `packages/db/drizzle/`

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat: add guest scoring columns to reservations table"
```

---

### Task 6: Create guest scoring library

**Files:**
- Create: `apps/web/src/lib/guest-scoring.ts`

- [ ] **Step 1: Create the scoring function**

Create `apps/web/src/lib/guest-scoring.ts`:

```typescript
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
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/guest-scoring.ts
git commit -m "feat: add guest scoring library with AI risk assessment"
```

---

### Task 7: Add scoring to Hospitable sync

**Files:**
- Modify: `apps/web/src/app/api/admin/sync-hospitable/handler.ts:195-203`

- [ ] **Step 1: Import scoring function and add scoring call after reservation upsert**

In `apps/web/src/app/api/admin/sync-hospitable/handler.ts`, add to imports:

```typescript
import { scoreGuest } from '@/lib/guest-scoring';
```

Then after the status-change system message block (after line 230, before the message loop), add:

```typescript
      // --- Score reservation if not yet scored ---
      const [currentRes] = await db
        .select({ guestScoredAt: reservations.guestScoredAt })
        .from(reservations)
        .where(eq(reservations.id, normalized.id))
        .limit(1);

      if (!currentRes?.guestScoredAt) {
        try {
          const scoreResult = await scoreGuest(normalized.id);
          if (scoreResult) {
            await db
              .update(reservations)
              .set({
                guestScore: scoreResult.score,
                guestScoreSummary: scoreResult.summary,
                guestScoredAt: new Date(),
              })
              .where(eq(reservations.id, normalized.id));
          }
        } catch {
          // Scoring failure is non-fatal — user can re-score manually
        }
      }
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/admin/sync-hospitable/handler.ts
git commit -m "feat: auto-score new reservations during Hospitable sync"
```

---

### Task 8: Create re-score API endpoint

**Files:**
- Create: `apps/web/src/app/api/inbox/[reservationId]/score/handler.ts`
- Create: `apps/web/src/app/api/inbox/[reservationId]/score/route.ts`

- [ ] **Step 1: Create handler with scoring logic**

Create `apps/web/src/app/api/inbox/[reservationId]/score/handler.ts`:

```typescript
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { scoreGuest } from '@/lib/guest-scoring';
import { reservations } from '@walt/db';

export async function handleScoreGuest(reservationId: string) {
  const [reservation] = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);

  if (!reservation) {
    return { error: 'Reservation not found', status: 404 } as const;
  }

  const result = await scoreGuest(reservationId);
  if (!result) {
    return { error: 'Scoring failed', status: 503 } as const;
  }

  await db
    .update(reservations)
    .set({
      guestScore: result.score,
      guestScoreSummary: result.summary,
      guestScoredAt: new Date(),
    })
    .where(eq(reservations.id, reservationId));

  return {
    score: result.score,
    summary: result.summary,
    scoredAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Create route file**

Create `apps/web/src/app/api/inbox/[reservationId]/score/route.ts`:

```typescript
import { NextResponse } from 'next/server';

import { withPermission } from '@/lib/auth/authorize';
import { handleApiError } from '@/lib/secure-logger';
import { handleScoreGuest } from './handler';

type Params = { params: Promise<{ reservationId: string }> };

export const POST = withPermission(
  'inbox.read',
  async (_request: Request, { params }: Params) => {
    try {
      const { reservationId } = await params;
      const result = await handleScoreGuest(reservationId);

      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json(result);
    } catch (error) {
      return handleApiError({ error, route: '/api/inbox/[reservationId]/score' });
    }
  },
);
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/inbox/[reservationId]/score/
git commit -m "feat: add POST /api/inbox/[reservationId]/score endpoint for manual re-scoring"
```

---

### Task 9: Add guest score to inbox API response

**Files:**
- Modify: `apps/web/src/app/api/inbox/route.ts:45-56`
- Modify: `apps/web/src/app/api/inbox/route.ts:108-124`
- Modify: `apps/web/src/app/inbox/InboxClient.tsx:7-23`

- [ ] **Step 1: Add `guestScore` to reservation select in inbox API**

In `apps/web/src/app/api/inbox/route.ts`, add `guestScore` and `guestScoreSummary` to the `reservationRows` select (around line 55, after `status`):

```typescript
        guestScore: reservations.guestScore,
        guestScoreSummary: reservations.guestScoreSummary,
```

- [ ] **Step 2: Include `guestScore` in thread list building**

In the same file, add `guestScore` and `guestScoreSummary` to the return object inside the `threads` map (around line 117, after `status`):

```typescript
        guestScore: res?.guestScore ?? null,
        guestScoreSummary: res?.guestScoreSummary ?? null,
```

- [ ] **Step 3: Update `InboxThread` type**

In `apps/web/src/app/inbox/InboxClient.tsx`, add to the `InboxThread` type (after `status`):

```typescript
  guestScore: number | null;
  guestScoreSummary: string | null;
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/inbox/route.ts apps/web/src/app/inbox/InboxClient.tsx
git commit -m "feat: include guest score in inbox API response and InboxThread type"
```

---

### Task 10: Display guest score badge on inbox cards

**Files:**
- Modify: `apps/web/src/app/inbox/ConversationList.tsx:129-144`

- [ ] **Step 1: Add score badge rendering after the status badge**

In `apps/web/src/app/inbox/ConversationList.tsx`, inside the thread button's header div (around line 136-140, after the status badge block), add:

```tsx
                  {t.guestScore != null && (
                    <Badge
                      className={`text-[9px] h-4 border-0 ${
                        t.guestScore >= 8
                          ? 'bg-green-100 text-green-700'
                          : t.guestScore >= 5
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {t.guestScore}/10
                    </Badge>
                  )}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/inbox/ConversationList.tsx
git commit -m "feat: display guest score badge on inbox conversation cards"
```

---

### Task 11: Add score + summary + re-score button to conversation thread

**Files:**
- Modify: `apps/web/src/app/inbox/ConversationThread.tsx:19-28`
- Modify: `apps/web/src/app/inbox/ConversationThread.tsx:146-172`
- Modify: `apps/web/src/app/api/inbox/[reservationId]/messages/route.ts:33-41`

- [ ] **Step 1: Add score fields to messages API response**

In `apps/web/src/app/api/inbox/[reservationId]/messages/route.ts`, add to the reservation select (around line 41, after `status`):

```typescript
            guestScore: reservations.guestScore,
            guestScoreSummary: reservations.guestScoreSummary,
            guestScoredAt: reservations.guestScoredAt,
```

And in the response mapping (around line 61, after `status`):

```typescript
            guestScore: reservationRow.guestScore,
            guestScoreSummary: reservationRow.guestScoreSummary,
            guestScoredAt: reservationRow.guestScoredAt?.toISOString() ?? null,
```

- [ ] **Step 2: Update `ReservationInfo` type in ConversationThread**

In `apps/web/src/app/inbox/ConversationThread.tsx`, add to the `ReservationInfo` type (around line 27, after `status`):

```typescript
  guestScore: number | null;
  guestScoreSummary: string | null;
  guestScoredAt: string | null;
```

- [ ] **Step 3: Add scoring state and re-score handler**

In `apps/web/src/app/inbox/ConversationThread.tsx`, add state and handler after the existing state declarations (around line 63, after `const [loadingOlder, setLoadingOlder] = useState(false);`):

```typescript
  const [scoring, setScoring] = useState(false);
```

Add the re-score handler function after `loadOlder` (around line 118):

```typescript
  const handleRescore = useCallback(async () => {
    setScoring(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/inbox/${reservationId}/score`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await fetchMessages();
        setMessages(data.messages);
        setReservation(data.reservation);
      }
    } finally {
      setScoring(false);
    }
  }, [reservationId, getToken, fetchMessages]);
```

- [ ] **Step 4: Add score display to thread header**

In `apps/web/src/app/inbox/ConversationThread.tsx`, add the `RefreshCw` icon import:

```typescript
import { RefreshCw } from 'lucide-react';
```

Then after the property/dates line in the header (around line 170, after the closing `</p>` of the subtitle), add:

```tsx
          {reservation?.guestScore != null && (
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  reservation.guestScore >= 8
                    ? 'bg-green-100 text-green-700'
                    : reservation.guestScore >= 5
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {reservation.guestScore}/10
              </span>
              <span className="text-xs text-slate-500">{reservation.guestScoreSummary}</span>
              <button
                onClick={handleRescore}
                disabled={scoring}
                className="text-slate-400 hover:text-sky-600 disabled:opacity-50"
                title="Re-score guest"
              >
                <RefreshCw className={`h-3 w-3 ${scoring ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
          {reservation?.guestScore == null && (
            <button
              onClick={handleRescore}
              disabled={scoring}
              className="flex items-center gap-1 mt-1 text-xs text-slate-400 hover:text-sky-600 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${scoring ? 'animate-spin' : ''}`} />
              {scoring ? 'Scoring...' : 'Score guest'}
            </button>
          )}
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm turbo run typecheck --filter=@walt/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/inbox/[reservationId]/messages/route.ts apps/web/src/app/inbox/ConversationThread.tsx
git commit -m "feat: display guest score and re-score button in conversation thread header"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full typecheck and lint**

Run: `pnpm turbo run typecheck lint --filter=@walt/web`
Expected: PASS

- [ ] **Step 2: Run build**

Run: `pnpm turbo run build --filter=@walt/web`
Expected: PASS

- [ ] **Step 3: Run normalizer tests**

Run: `cd apps/web && npx tsx --test src/lib/hospitable-normalize.test.ts`
Expected: All tests PASS
