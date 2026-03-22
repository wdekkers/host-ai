# Approval Queue — Inbox Enhancement Design

**Ticket:** #002 (Build approval queue UI — the command center landing page)
**Date:** 2026-03-21
**Status:** Draft

## Goal

Evolve the existing inbox into the communication command center described in the product plan. No new pages — enhance the inbox with draft lifecycle tracking, source citations, escalation detection, urgency sorting, and Hospitable send integration.

## Non-Goals

- Separate `/queue` page (decided against — inbox IS the command center)
- Proactive/scheduled message generation (ticket #010)
- Structured property onboarding fields (ticket #006)
- Formal event contracts in packages/contracts (ticket #004)
- Selective autopilot / auto-send (ticket #020)

---

## 1. Data Model Changes

### 1.1 New columns on `messages` table

Add to the existing `messages` table in `packages/db/src/schema.ts`:

```typescript
draftStatus: text('draft_status'),
// null for non-AI messages, otherwise: 'pending_review' | 'approved' | 'sent' | 'rejected'

intent: text('intent'),
// Classified intent label, e.g. 'early_check_in', 'pool_heating', 'booking_request'

escalationLevel: text('escalation_level'),
// 'none' | 'caution' | 'escalate'

escalationReason: text('escalation_reason'),
// Human-readable explanation of why escalation was triggered

sourcesUsed: jsonb('sources_used'),
// Array of { type: 'knowledge_entry' | 'property_field' | 'property_memory', id: string, label: string }
```

**Why these live on `messages`:** They describe the current state of a specific AI draft and are queried frequently for the inbox list view. Keeping them on the message avoids joins for every thread render.

### 1.2 New `draft_events` table

Append-only log tracking every action on an AI draft:

```typescript
export const draftEvents = waltSchema.table('draft_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  messageId: uuid('message_id').notNull().references(() => messages.id),
  action: text('action').notNull(),
  // 'generated' | 'regenerated' | 'edited' | 'approved' | 'sent' | 'rejected'
  actorId: text('actor_id'),
  // Clerk user ID of the person who took the action; null for system actions (generation)
  beforePayload: text('before_payload'),
  // Original draft text (for edits: what it was before)
  afterPayload: text('after_payload'),
  // Result text (for edits: what it became; for generation: the draft)
  metadata: jsonb('metadata'),
  // Flexible context: { sourcesUsed, intent, escalationLevel, chips, extraContext, confidence }
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Indexes:**
- `(messageId, createdAt)` — query draft history for a specific message
- `(organizationId, createdAt)` — query recent draft activity across org

### 1.3 Events table usage

In addition to `draft_events`, write domain events to the existing `events` table for the broader event-sourcing audit trail. Event types:

- `MessageDraftGenerated` — payload: messageId, reservationId, propertyId, intent, escalationLevel, sourcesUsed
- `MessageDraftApproved` — payload: messageId, actorId, originalDraft, finalText, wasEdited
- `MessageDraftSent` — payload: messageId, actorId, platform, hospitable response status
- `MessageDraftRejected` — payload: messageId, actorId, reason (optional)

These use the existing `events` table structure (type, account_id, aggregate_id, payload jsonb).

**Note:** The `events` table `id` column has no `.defaultRandom()` — callers must supply an explicit UUID (e.g., `crypto.randomUUID()`) when inserting.

---

## 2. AI Generation Enhancements

### 2.1 Responsibility split: `analyzeMessage()` vs `generateReplySuggestion()`

Two distinct functions with clear ownership:

- **`analyzeMessage()`** — single source of truth for `intent`, `escalationLevel`, `escalationReason`, and `suggestedTask`. Runs classification + escalation detection. Does NOT generate drafts.
- **`generateReplySuggestion()`** — generates the draft text and tracks which sources were provided as context. Returns `suggestion` + `sourcesUsed` only. Does NOT classify intent or detect escalation.

Callers (cron, suggest API) call `analyzeMessage()` first, then `generateReplySuggestion()`, and combine the results.

### 2.2 Source tracking in `generateReplySuggestion()`

**Current behavior:** Fetches knowledge entries and property memory, includes them in the LLM prompt, returns only the suggestion string.

**New behavior:** Return a structured result object:

```typescript
interface SuggestionResult {
  suggestion: string;
  sourcesUsed: SourceReference[];
}

interface SourceReference {
  type: 'knowledge_entry' | 'property_field' | 'property_memory';
  id: string;        // DB id of the knowledge entry or property field name
  label: string;     // Human-readable label for display
  snippet?: string;  // Relevant excerpt (optional, for display)
}
```

**Implementation approach:**
1. Track which knowledge entries and property memory facts are fetched and included in the prompt context.
2. Record each source as a `SourceReference` with its ID and a human-readable label.
3. The sources list represents what was **provided to the LLM** as context. This is deterministic — no need to parse the LLM output to figure out what it "used."
4. Persist the `sourcesUsed` array on the message record and in the `draft_events` metadata.

### 2.3 Escalation detection (hybrid keyword + LLM)

**Two-layer detection** run on every inbound guest message:

**Layer 1 — Keyword pre-filter (fast, cheap):**

```typescript
const ESCALATION_KEYWORDS = {
  escalate: ['refund', 'lawyer', 'attorney', 'sue', 'injured', 'injury',
             'blood', 'hospital', 'police', 'fire department', 'weapon',
             'threatened', 'unsafe', 'discriminat'],
  caution: ['damage', 'broken', 'not working', 'disgusting', 'unacceptable',
            'worst', 'review', 'report', 'complain', 'compensat', 'money back',
            'airbnb support', 'resolution center'],
};
```

If keywords match, set a `keywordFlag` but don't stop — always run LLM layer too.

**Layer 2 — LLM classification (accurate, authoritative):**

Extend the existing `classifyMessage()` function (or create a new `analyzeMessage()` that wraps it) to return:

```typescript
interface MessageAnalysis {
  intent: string;             // e.g. 'early_check_in', 'pool_heating', 'general_question'
  escalationLevel: 'none' | 'caution' | 'escalate';
  escalationReason: string | null;
  suggestedTask: SuggestedTask | null;  // existing functionality
}
```

The LLM prompt instructs:
- `escalate`: refund/comp requests, safety incidents, accusations, threats, claims of injury, policy exceptions, money collection, guest expressing significant anger/distress
- `caution`: complaints about amenities, requests for exceptions, mentions of reviews, mild frustration
- `none`: standard questions, informational, positive messages

**Resolution logic:**
- LLM result is authoritative
- If keyword pre-filter flagged `escalate` but LLM says `none`, use `caution` (trust the LLM but don't fully ignore the keyword signal)
- If keyword says `caution` and LLM says `none`, use `none` (keywords are noisy for caution-level)

### 2.4 Integration with scan-messages cron

The existing `POST /api/cron/scan-messages` currently:
1. Finds unscanned guest messages
2. Runs `classifyMessage()` for task suggestions
3. Marks as scanned

**Enhanced flow:**
1. Find unscanned guest messages
2. Run `analyzeMessage()` — returns intent, escalationLevel, escalationReason, and suggestedTask
3. Run `generateReplySuggestion()` — returns suggestion and sourcesUsed
4. Combine results and update message record with: `suggestion`, `suggestionGeneratedAt`, `draftStatus='pending_review'`, `intent` (from analyzeMessage), `escalationLevel` (from analyzeMessage), `escalationReason` (from analyzeMessage), `sourcesUsed` (from generateReplySuggestion)
5. Insert `draft_events` record (action: 'generated', metadata includes combined results)
6. Insert `events` record (type: 'MessageDraftGenerated')
7. If suggestedTask detected, insert `taskSuggestions` record (existing behavior)
8. Mark as scanned

---

## 3. API Changes

### 3.1 Enhanced `GET /api/inbox`

**New response fields per thread:**
```typescript
interface InboxThread {
  // ... existing fields ...
  draftStatus: 'pending_review' | 'approved' | 'sent' | 'rejected' | null;
  intent: string | null;
  escalationLevel: 'none' | 'caution' | 'escalate' | null;
  escalationReason: string | null;
}
```

**Sorting:**
- Unreplied threads first, sorted by oldest guest message waiting
- Then all other threads sorted by most recent activity

**New filter values:**
- `all` (default) — all threads
- `unreplied` — threads where guest is waiting
- `ai_ready` — unreplied + AI draft exists
- `escalated` — threads with escalationLevel = 'caution' or 'escalate'

### 3.2 Enhanced `POST /api/inbox/[reservationId]/suggest`

**Current:** Returns `{ suggestion: string }`

**New behavior:** Calls `analyzeMessage()` then `generateReplySuggestion()` and combines results.

**New response:**
```typescript
{
  suggestion: string;
  sourcesUsed: SourceReference[];
  intent: string;                    // from analyzeMessage()
  escalationLevel: 'none' | 'caution' | 'escalate';  // from analyzeMessage()
  escalationReason: string | null;   // from analyzeMessage()
}
```

**Side effects:**
- Update message: `draftStatus`, `intent`, `escalationLevel`, `escalationReason`, `sourcesUsed`
- Insert `draft_events` record (action: 'generated' or 'regenerated')

### 3.3 Enhanced `POST /api/inbox/[reservationId]/send`

**Current:** Creates host message record in DB only.

**New input field:**
```typescript
{
  suggestion: string;     // the final text to send
  messageId?: string;     // the original guest message this is a reply to (for draft tracking)
}
```

**Two paths based on `messageId`:**

**Path A — AI-assisted reply** (messageId provided):
1. Look up the message and validate `draftStatus` is `pending_review` or `approved`
2. If the sent text differs from the original suggestion, record it as an edit:
   - Insert `draft_events` (action: 'edited', beforePayload: original, afterPayload: final)
3. Insert `draft_events` (action: 'approved', actorId from Clerk session)
4. Send message via Hospitable API (see section 4)
5. Insert `draft_events` (action: 'sent')
6. Update message: `draftStatus = 'sent'`
7. Insert `events` record (type: 'MessageDraftApproved', 'MessageDraftSent')
8. Create host message record (existing behavior)

**Path B — Manual reply** (no messageId):
1. Send message via Hospitable API (see section 4)
2. Create host message record (existing behavior)
3. No draft lifecycle tracking — this is a freeform host reply

### 3.4 New `POST /api/inbox/[reservationId]/reject`

Dismiss/reject an AI draft:

```typescript
// Input
{ messageId: string; reason?: string; }

// Behavior
1. Update message: draftStatus = 'rejected'
2. Insert draft_events (action: 'rejected', actorId, metadata: { reason })
3. Insert events record (type: 'MessageDraftRejected')
```

### 3.5 New `GET /api/inbox/[reservationId]/draft-history?messageId=<uuid>`

Return the full draft event history for a specific message. The `messageId` is passed as a required query parameter.

```typescript
// Query params
{ messageId: string }  // required

// Response
{
  events: Array<{
    action: string;
    actorId: string | null;
    beforePayload: string | null;
    afterPayload: string | null;
    metadata: object | null;
    createdAt: string;
  }>;
}
```

---

## 4. Hospitable Send Integration

### 4.1 Hospitable API for sending messages

Wire the send route to call Hospitable's API to deliver the message back to the guest on their booking platform (Airbnb, VRBO, etc.).

**Implementation:**
1. Look up the reservation's Hospitable conversation ID (stored or derivable from existing data)
2. POST to Hospitable's message send endpoint with the approved text
3. Store the Hospitable response (success/failure, message ID) in `draft_events` metadata
4. If Hospitable send fails: update `draftStatus` back to `approved` (not `sent`), surface error to host

**Error handling:**
- Network failure: retry once, then surface error in UI
- API error (rate limit, auth): surface specific error to host
- Never mark as `sent` unless Hospitable confirms delivery

### 4.2 Adapter pattern

Wrap the Hospitable API call behind an interface so other platforms can be added later:

```typescript
interface MessageSender {
  send(conversationId: string, body: string): Promise<SendResult>;
}

interface SendResult {
  success: boolean;
  platformMessageId?: string;
  error?: string;
}
```

---

## 5. UI Changes

### 5.1 Thread list (`ConversationList.tsx`)

**Sorting changes:**
- Unreplied threads first (sorted by oldest guest message waiting)
- Then all threads by most recent activity
- No complex urgency scoring — urgent messages are naturally recent

**New visual elements per thread card:**
- **Escalation badge**: red dot/icon for `escalate`, amber for `caution`; visible in the thread list
- **Intent chip**: small label showing classified intent (e.g., "Early Check-in", "Pool Heating"); displayed below guest name or next to property name

**New filter tab:**
- Add `Escalated` tab alongside existing All / Unreplied / AI Ready

### 5.2 Draft panel (`AiDraftPanel.tsx`)

**Escalation banner:**
- When `escalationLevel` is `caution` or `escalate`, show a banner at the top of the draft panel
- Banner shows the `escalationReason` text
- `escalate` level: red banner, text like "Requires manual review: {reason}"
- `caution` level: amber banner, text like "Review carefully: {reason}"

**Sources Used section:**
- Collapsible section below the draft text, above the action buttons
- Header: "Context used" with chevron toggle
- Lists each source with its type icon and label:
  - Knowledge entry: book icon + entry question/title
  - Property memory: lightbulb icon + fact summary
  - Property field: building icon + field name
- Collapsed by default to keep the UI clean

**Draft status indicator:**
- Small status badge showing current draft state: "AI Draft", "Approved", "Sent", "Rejected"

**Reject button:**
- Add a "Dismiss" or "Reject" action alongside the existing "Approve & Send"
- Optional reason input (simple text field, not required)

**Edit tracking:**
- When host modifies the draft text before sending, the send handler captures both original and final version
- No UI change needed — the diff is captured automatically in the API

### 5.3 Conversation thread (`ConversationThread.tsx`)

**Sent message indicator:**
- Messages sent via the approval flow show a small "Sent via AI" or "AI-assisted" label
- Shows whether the message was sent as-is or edited before sending

---

## 6. File Changes Summary

**Important:** Per CLAUDE.md, route files (`route.ts`) may only export HTTP method handlers. Business logic must live in a sibling `handler.ts` file. All new routes must follow this pattern. Existing inbox routes (`route.ts`, `send/route.ts`, `suggest/route.ts`) currently have inline logic — refactor them to use `handler.ts` as part of this work.

### Schema (`packages/db/src/schema.ts`)
- Add columns to `messages`: `draftStatus`, `intent`, `escalationLevel`, `escalationReason`, `sourcesUsed`
- Add new `draftEvents` table (using `waltSchema.table`, `text` for organizationId)

### AI logic (`apps/web/src/lib/`)
- `generate-reply-suggestion.ts` — return `SuggestionResult` (suggestion + sourcesUsed) instead of `string | null`
- `ai/classify-message.ts` — enhance to `analyzeMessage()` returning `MessageAnalysis` (intent + escalation + task suggestion)
- New: `ai/escalation-keywords.ts` — keyword pre-filter constants and matcher

### API routes (`apps/web/src/app/api/inbox/`)

Each route gets a `handler.ts` for business logic and a `route.ts` that only re-exports handlers:

- `handler.ts` + `route.ts` (GET) — add new fields and sorting to thread list query
- `[reservationId]/suggest/handler.ts` + `route.ts` — return enhanced result, persist metadata
- `[reservationId]/send/handler.ts` + `route.ts` — add draft event logging, Hospitable API call, dual path (AI-assisted vs manual)
- New: `[reservationId]/reject/handler.ts` + `route.ts` — reject/dismiss draft
- New: `[reservationId]/draft-history/handler.ts` + `route.ts` — draft event log

### Cron (`apps/web/src/app/api/cron/scan-messages/`)
- `handler.ts` — enhanced flow: analyzeMessage() + generateReplySuggestion() + persist metadata + draft events

### UI components (`apps/web/src/app/inbox/`)
- `ConversationList.tsx` — sorting, escalation badges, intent chips, escalated filter tab
- `AiDraftPanel.tsx` — sources section, escalation banner, reject action, draft status badge; fix "Approve & Send" button to use `bg-sky-600` instead of `bg-green-600` (per UI standards: sky-600 accent, never green)
- `ConversationThread.tsx` — AI-assisted send indicator on messages
- `SuggestionPanel.tsx` — legacy component in `inbox/[reservationId]/`; assess during implementation whether to remove or leave (do not modify)

### Integration
- New: `apps/web/src/lib/hospitable/send-message.ts` — Hospitable API adapter for sending messages
- Reference: Hospitable API docs at `docs/webhookdocs.txt` for message send endpoint; authentication via API key in environment variable `HOSPITABLE_API_KEY`

---

## 7. Migration Strategy

1. Database migration adds new columns (all nullable) and new table — zero breaking changes
2. Existing messages with `suggestion` column populated get `draftStatus = null` (not retroactively set)
3. New messages processed after deployment get full metadata
4. UI changes are additive — new elements appear only when data is present (graceful degradation)
5. Hospitable send is behind the existing send button — replaces the current "save only" behavior
