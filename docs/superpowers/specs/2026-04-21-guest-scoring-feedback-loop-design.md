# Guest Scoring Feedback Loop

**Status:** Draft
**Date:** 2026-04-21
**Author:** Wesley

## Problem

The current AI guest scorer (`apps/web/src/lib/guest-scoring.ts`) produces unreliable scores for boundary-pushing guests. Example: a guest with a clean opening message (insurance relocation, family of four) scored 8/10, despite later pushing for a pet deposit exception and asking about bringing friends over to swim — behaviour the scorer never saw because it only reads the *first* guest message.

Root causes:

1. **Weak inputs.** Scorer reads only the first guest message, a name-based lookup in the `guests` table, and booking facts. It does not see the rest of the conversation, the listing's house rules, or any past reviews.
2. **No feedback loop.** When the host spots a bad score, there is no way to teach the system. Every similar guest in the future gets the same 8/10.

## Goals

- Let the host give feedback on a score and save that feedback as either a global "house rule / red-flag pattern" or a guest-specific note.
- Rescore on demand, using the latest rules and a richer input set.
- Give the AI enough context (full thread, property house rules, past reviews, host rules, internal history) to catch patterns like exception-seeking and vague event requests.

## Non-goals

- No changes to the reply assistant, journeys, or property Q&A.
- No rule categories, severities, tags, or ordering. Rules are a flat list of sentences.
- No change to the scoring model (stays on `gpt-4o-mini`).
- No manual score override. Feedback-driven rescore is the only way a score changes.
- No ML training. "Learning" means the AI sees an updated rules list on the next call — nothing is fine-tuned.

## Design

### Data model

**New table `scoring_rules`** (org-scoped, editable from UI):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | text | fk to org |
| `rule_text` | text | free-text sentence |
| `active` | boolean | default true |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `created_by` | text | user id |

**`properties` table — add column**:

| Column | Type | Notes |
|---|---|---|
| `house_rules` | text | synced from Hospitable; stored as plain text blob. If Hospitable returns structured fields (e.g. `no_smoking: true`, `check_in_after: "16:00"`), store as `jsonb` instead and render to text at prompt-time. Decision made when the property sync is extended (see Implementation Notes). |

**Existing tables used unchanged**:

- `reviews` — already in schema, not yet synced. Sync handler will populate it.
- `guests.notes` — already used by the scorer; continues to hold per-guest feedback.

### Reviews sync

Extend `apps/web/src/app/api/admin/sync-hospitable/handler.ts` to pull reviews via the existing `@walt/hospitable` reviews client and upsert into the `reviews` table. Key fields: `id`, `rating`, `publicReview`, `privateFeedback`, `guestFirstName`, `guestLastName`, `reviewedAt`, `raw`.

Matching to guests at score-time is by first + last name — the same heuristic already used for the `guests` lookup. No FK; reviews can exist for guests we've never scored.

Review sync failure must not fail the whole sync — log and continue.

### Scorer inputs

Rewrite `scoreGuest()` to assemble the prompt from:

1. **Booking facts** (unchanged) — guest count, nights, lead time, arrival day-of-week.
2. **Property house rules** — `SELECT house_rules FROM properties WHERE id = reservation.property_id`.
3. **Host scoring rules** — `SELECT rule_text FROM scoring_rules WHERE active AND organization_id = ?`.
4. **Full conversation thread** — all `messages` rows for the reservation, chronological. Char budget ~8K; trim oldest first; always keep the most recent 20 messages regardless of budget.
5. **Internal guest history** (unchanged) — `guests` row by first+last name.
6. **Past reviews** — `SELECT rating, public_review, private_feedback FROM reviews WHERE guest_first_name = ? AND guest_last_name = ?`. Summarised as `★<rating> — "<snippet>"` lines.

Any section whose source data is empty is omitted from the prompt entirely (no "None" placeholders — saves tokens, avoids negative priming).

### Prompt structure

```
You are a short-term rental risk assessor. Score this guest 1–10.
10 = ideal, 1 = high risk. Respond ONLY as JSON: {"score": <1-10>, "summary": "<string>"}.

PROPERTY HOUSE RULES (what the guest is asked to accept):
<house_rules text>

HOST RULES AND RED FLAGS (weigh heavily):
- <rule 1>
- <rule 2>
...

BOOKING:
- Guest name, count, nights, arrival day, lead time

CONVERSATION SO FAR:
<chronological host + guest messages>

GUEST HISTORY:
- Internal notes: <...>
- Past reviews: ★4 — "...", ★5 — "..."
```

Model: `gpt-4o-mini`. `temperature: 0.3`. `max_tokens: 400` (up from 200 so the summary can cite rule matches).

### UI

**Inbox score card** (wherever the score is rendered today in `ConversationThread.tsx` / related components) gains two buttons:

- **Rescore** — `POST /api/inbox/[reservationId]/score`. No API change; the handler already exists. The richer inputs come from the `scoreGuest()` rewrite.
- **Give feedback** — opens a modal:
  - Textarea: "What did the AI miss?"
  - Radio: **Save as house rule (applies to all future guests)** or **Save as note on this guest only**
  - **Save** button. On submit:
    - House rule → `POST /api/scoring-rules` with `{ ruleText }` → inserts into `scoring_rules`.
    - Guest note → appends to `guests.notes` with an ISO timestamp prefix (`[2026-04-21] ...`). Creates the `guests` row if one doesn't exist for this name.
  - After save, auto-triggers a Rescore so the host sees the new score immediately.

**New settings page `/settings/scoring-rules`**:

- Table: rule text, active toggle, created date, delete.
- "Add rule" textarea at the top with a Save button.
- No categories, no search, no ordering. If the list grows unwieldy, revisit.

### API surface

| Method | Path | Body | Purpose |
|---|---|---|---|
| `POST` | `/api/inbox/[reservationId]/score` | — | Rescore. Already exists. |
| `POST` | `/api/inbox/[reservationId]/feedback` | `{ text, target: "rule" \| "guest" }` | Persist feedback, then rescore. |
| `GET` | `/api/scoring-rules` | — | List org's rules. |
| `POST` | `/api/scoring-rules` | `{ ruleText }` | Create rule. |
| `PATCH` | `/api/scoring-rules/[id]` | `{ active?, ruleText? }` | Edit / toggle. |
| `DELETE` | `/api/scoring-rules/[id]` | — | Delete rule. |

All routes require authenticated host session. Zod validation on all inputs. Route files expose only HTTP handlers; logic in sibling `handler.ts` per project convention.

### Error handling

- Scoring call fails (OpenAI error, bad JSON) → `scoreGuest()` returns `null`; route returns 503; no DB writes.
- Rules list, property house rules, or reviews empty → that section omitted from the prompt.
- Review sync failure → logged, rest of sync continues.
- Feedback submit without a matching `guests` row → create one.
- Concurrent rescores → last write wins (no lock needed; idempotent-ish).

### Testing

- **Unit: `scoreGuest()`** with mocked OpenAI. Cover: prompt includes rules/thread/reviews/house-rules when present; omits each section when absent; thread truncation keeps most-recent 20.
- **Unit: feedback handler.** `target: "rule"` inserts into `scoring_rules`; `target: "guest"` appends to `guests.notes` and creates a `guests` row if missing.
- **Route tests:** `POST /api/scoring-rules` (auth required, Zod validation), `POST /api/inbox/[id]/feedback`.
- **Sync test:** reviews upsert idempotency (running sync twice produces one row per review).

### Out of scope / follow-ups

- Past reviews from non-Hospitable platforms.
- Per-property (instead of org-wide) scoring rules.
- Manual score override.
- Fine-tuning or a custom model.
- Automated re-scoring on every new guest message (today: on-demand only).

## Implementation notes

- Keep `@walt/hospitable` as the only way to hit Hospitable. Do not `fetch()` directly from the web app.
- Zod schema for the new `scoring_rules` inputs lives in the route's `handler.ts`. If it's reused by another service later, promote to `@walt/contracts`.
- House rules column type (`text` vs `jsonb`) is decided during the property sync extension based on what the Hospitable Property response actually contains. Default to `text` unless structure provides real value.
- Char budget for the thread (8K) and max review snippet length (~300 chars each, max 5 reviews) are starting values — tune once we see token usage in practice.
