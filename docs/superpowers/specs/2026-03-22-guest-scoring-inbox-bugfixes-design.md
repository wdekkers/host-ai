# Guest Scoring & Inbox/Calendar Bug Fixes

**Date:** 2026-03-22
**Status:** Approved

## Overview

Two workstreams:
1. AI-powered guest scoring on incoming booking requests
2. Three bug fixes: calendar showing cancelled bookings, missing inbox status badges, cancelled reservation priority

---

## Feature: AI Guest Scoring

### Data Model

Three new columns on the `reservations` table:

| Column | Type | Purpose |
|--------|------|---------|
| `guestScore` | `integer` (1-10, nullable) | Numeric risk/quality score |
| `guestScoreSummary` | `text` (nullable) | AI-written advisory summary |
| `guestScoredAt` | `timestamp` (nullable) | When the score was last computed |

No new tables. Score is contextual to the specific booking — same guest may score differently depending on booking characteristics.

After modifying `schema.ts`, generate a Drizzle migration with `pnpm drizzle-kit generate`.

### Scoring Signals

1. **Guest count** — extracted from `raw` JSON on the reservation. Hospitable sends a nested `guests` object with fields: `total`, `adult_count`, `child_count`, `infant_count`, `pet_count`. Higher guest count for short stays = higher risk.
2. **Booking pattern** — days between `bookingDate` and `arrivalDate` (last-minute = higher risk), `nights` duration, day-of-week (weekend-only short stay = higher risk).
3. **Guest message content** — first message from guest in the thread analyzed by AI for red flags (party mentions, large groups, evasive about purpose) and positive signals (family trip, business, clear communication).
4. **Internal guest history** — look up guest in `guests` table by name (email often null due to Hospitable API limitations). Guest lookup needs `organizationId` but reservations lack this column; use a broad lookup by name as a workaround. If repeat guest, use `rating` and `hostAgain` values. If new guest, neutral signal.

### Scoring Prompt

```
You are a short-term rental risk assessor.
Given this booking data, score the guest 1-10
(10 = ideal guest, 1 = high risk) and write
a 1-2 sentence advisory summary.

Inputs: {guestCount, bookingLeadDays, nights,
dayOfWeek, guestMessage, internalHistory}
```

Returns JSON: `{ score: number, summary: string }`

### When Scoring Runs

**Auto-score during sync:**
- In `syncHospitable()`, after upserting a reservation, check if `guestScoredAt` is null (new reservation).
- If new: gather signals, call AI scoring function, update reservation with score/summary/timestamp.
- If existing and already scored: skip.
- If AI call fails: reservation still upserts with `guestScore = null`. User can manually trigger later.

**Manual re-score:**
- New API endpoint: `POST /api/inbox/[reservationId]/score`
- Business logic lives in sibling `handler.ts` per CLAUDE.md convention.
- Re-gathers all signals including any new messages since last score.
- Overwrites `guestScore`, `guestScoreSummary`, `guestScoredAt`.
- Returns the new score to the client.

**Edge case:** If the AI call fails during sync (timeout, rate limit), the reservation still gets upserted — just with `guestScore = null`. The user can manually trigger scoring later.

### UI Display

**Inbox card (ConversationList):**
- Score badge next to the status badge (e.g., `Pending` then `7/10`).
- Color coded: 8-10 green, 5-7 amber, 1-4 red.
- If `guestScore` is null, no badge shown.

**Conversation thread header (ConversationThread):**
- Score displayed prominently with full AI summary text below.
- "Re-score" button triggers `POST /api/inbox/[reservationId]/score`.
- Loading state while re-scoring, updates in place when done.

**Calendar:** No changes. Score is inbox-only.

---

## Bug Fix 1: Calendar Shows Cancelled Bookings

**Problem:** The calendar API (`/api/calendar/route.ts`) fetches all reservations overlapping the date range with no status filter. Cancelled bookings render on the calendar grid, hiding replacement bookings.

**Fix:** Add `ne(reservations.status, 'cancelled')` to the calendar API query's `where` clause. Cancelled bookings disappear from the grid; new bookings for the same dates become visible.

---

## Bug Fix 2: Inbox Only Shows "Cancelled" Status Badge

### Root Cause

The Hospitable API's top-level `status` field is **deprecated** and sends `"booking"` for all active reservations. The real status lives in `reservation_status.current.category` (a nested object with `category` and `sub_category`).

The normalizer (`hospitable-normalize.ts`) reads `raw.status` (the deprecated field), so the database stores `"booking"` for most reservations — which doesn't match any key in `STATUS_BADGE_CONFIG`. Only `"cancelled"` appears correctly because it's the one value that differs in the deprecated field.

### Fix

1. **Update `normalizeReservation`** to read from `reservation_status.current.category` instead of the deprecated `status` field. Fall back to `raw.status` if the nested field is absent (backwards compatibility with existing data).

2. **Update `STATUS_BADGE_CONFIG`** to match Hospitable's `reservation_status.current.category` values:
   - `inquiry` → Inquiry (sky-blue) — guest inquiry
   - `request` → Pending (amber) — booking request awaiting approval
   - `accepted` → Accepted (green) — confirmed booking
   - `cancelled` → Cancelled (red) — cancelled booking
   - Keep `confirmed` and `pending` as fallback aliases

3. **Update `CORE_STATUSES` and `STATUS_MESSAGES`** in the sync handler to match these category values so system messages are created correctly.

4. **Backfill existing reservations** — on next sync, reservations will get their status updated from the `reservation_status.current.category` field.

---

## Bug Fix 3: Cancelled Reservations Not Prioritized in Inbox

**Problem:** Inbox sorts by most recent message timestamp only. Cancelled reservations don't get special priority.

**Fix:** Modify inbox API sorting — recently cancelled reservations (status changed within last 24 hours, based on the system message timestamp) sort to the top. After 24 hours, they fall back to normal chronological order.

---

## Files Affected

| File | Changes |
|------|---------|
| `packages/db/src/schema.ts` | Add `guestScore`, `guestScoreSummary`, `guestScoredAt` columns to reservations |
| `packages/db/drizzle/` | New migration file generated by `pnpm drizzle-kit generate` |
| `apps/web/src/lib/hospitable-normalize.ts` | Read `reservation_status.current.category` instead of deprecated `status` field |
| `apps/web/src/lib/hospitable-normalize.test.ts` | Update test fixtures to include `reservation_status` object |
| `apps/web/src/app/api/calendar/route.ts` | Add cancelled status filter |
| `apps/web/src/app/inbox/status-config.ts` | Add `request`, `accepted` entries; keep `confirmed`/`pending` as aliases |
| `apps/web/src/app/api/admin/sync-hospitable/handler.ts` | Update CORE_STATUSES to match category values; add AI scoring call for new reservations |
| `apps/web/src/app/api/inbox/route.ts` | Add cancellation priority sorting; include `guestScore` in thread response |
| `apps/web/src/app/api/inbox/[reservationId]/messages/route.ts` | Include `guestScore`, `guestScoreSummary`, `guestScoredAt` in reservation response |
| `apps/web/src/app/api/inbox/[reservationId]/score/handler.ts` | New file: re-score business logic |
| `apps/web/src/app/api/inbox/[reservationId]/score/route.ts` | New endpoint: POST handler that imports from handler.ts |
| `apps/web/src/app/inbox/ConversationList.tsx` | Display score badge on inbox cards |
| `apps/web/src/app/inbox/ConversationThread.tsx` | Display score + summary + re-score button in thread header |
| `apps/web/src/lib/guest-scoring.ts` | New file: AI scoring function (signal gathering + prompt + parse) |
| `apps/web/src/app/inbox/InboxClient.tsx` | Add `guestScore`, `guestScoreSummary` to `InboxThread` type |
