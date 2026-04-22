# AI Draft: Skip Recommendation

**Status:** Draft
**Date:** 2026-04-22

## Problem

The AI reply drafter always produces a polite, inviting draft — even for conversations where a reply is counter-productive. Concrete case: guest Michelle Basden's score came back 3/10 (boundary-pushing, pressuring against house rules). Host replied "our decision on these dates is final." Guest followed up with an emotional plea. The drafter then generated:

> *"I completely understand your frustration... please don't hesitate to reach out. I'm here to help."*

This keeps the door open on a booking the host has closed, and rewards emotional manipulation.

Root cause: the drafter's system prompt defaults to "warm and helpful" and has no awareness of
- the current guest score,
- whether the host already declined,
- emotional-plea patterns that warrant silence.

## Goals

- Let the drafter return **"no reply recommended"** as a first-class output, not just a suggestion.
- Feed the score + score summary into the drafter's prompt.
- Add drafter-level rules that recognize prior host declines and emotional-plea follow-ups.
- Make sure the auto-reply cron (`scan-messages`) respects a skip — it must NOT auto-send when the drafter says skip.
- UI shows "No reply recommended" with the reason, and lets the host still write one manually if they want.

## Non-goals

- No DB migration. Skip state is a response shape only; nothing persisted beyond a `draftEvents` audit row.
- No new `conversationStatus` column on reservations. Prior-decline detection is prompt-level.
- No change to the scoring system or scoring rules.

## Design

### Drafter return type

Discriminated union from `generateReplySuggestion()`:

```ts
export type SuggestionResult =
  | { action: 'draft'; suggestion: string; sourcesUsed: SourceReference[] }
  | { action: 'skip'; reason: string; sourcesUsed: SourceReference[] };
```

Callers switch on `action`.

### New inputs

Add to `generateReplySuggestion`:
- `guestScore?: number | null`
- `guestScoreSummary?: string | null`
- `reservationStatus?: string | null` (already available on `reservations.status`)

### New prompt rules

Appended to the system prompt, above the existing `SYSTEM_RULES`:

```
DECISION RULES (apply in order):

1. If the reservation status is 'denied', 'declined', or 'cancelled', OR if a prior
   HOST message in this conversation clearly declines the booking (e.g. "our decision
   is final", "unable to accommodate", "will not be hosting"), do NOT draft a reply.

2. If the latest GUEST message is an emotional appeal or plea to reverse a prior host
   decline (guilt-tripping, mentioning children's disappointment, pressure about
   alternatives), do NOT draft a reply.

3. If the guest score is <= 4 AND the guest is actively pushing back on a stated
   house rule, draft only a brief, firm restatement of the decline. Do NOT invite
   further conversation.

Output is JSON:
  {"action": "draft", "text": "<reply>"}
  or
  {"action": "skip", "reason": "<short reason for the host>"}
```

### Response format

Use OpenAI `response_format: { type: 'json_object' }` to force JSON output. Validate with Zod on receipt; if parsing fails, fall back to `action: 'draft'` with the raw content (backward-compatible).

### API surface

`POST /api/inbox/[reservationId]/suggest` response:

```json
{ "action": "draft", "suggestion": "...", "sourcesUsed": [...], "intent": "...", ... }
```

or

```json
{ "action": "skip", "reason": "Host already declined this booking.", "sourcesUsed": [...] }
```

### UI

`AiDraftPanel` renders:
- `action: 'draft'` → existing UI (suggestion text + Send/Edit/Regenerate).
- `action: 'skip'` → a muted banner: *"No reply recommended — {reason}"*, with a **"Draft anyway"** button that falls back to manual composition.

### Auto-reply cron

`apps/web/src/app/api/cron/scan-messages/handler.ts`: if the drafter returns `action: 'skip'`, skip the auto-send and log the skip reason.

### DB side-effects

- `messages.suggestion` is only updated when `action === 'draft'`.
- On skip, insert a `draftEvents` row with `action: 'skipped'` and `metadata.skipReason`.

## Out of scope / follow-ups

- Proper `conversationStatus` field on reservations (open/declined/closed) — would replace the prompt-level detection in rule 1.
- Auto-close reservations after repeated decline + plea cycles.
- Telemetry on how often skip fires and whether hosts override it.
- **Draft caching on conversation switch.** Today the panel POSTs `/suggest` every time a conversation is opened, even when `messages.suggestion` is already populated. Next step: include `suggestion` + `suggestionSkipReason` in the messages list payload and have `AiDraftPanel` prefer the cached value on mount — regenerate only on Regenerate click or chip/context change. Defer because it touches the messages API contract.
